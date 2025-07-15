import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { exampleObject1, FilterTest } from '../../../../data/filterTest';
import { DbTest, getMongaLayerForFilterTest, isMongoServerError, ValueTest } from '../helper';
import { SchemaTest } from '../../../../data/schemaTest';
import { beforeAll, describe, expect, test } from '@jest/globals';

const valuesTable: ValueTest[] = [
    { value: '^[a-z]+$', success: true, message: 'should validate with valid string regex' },
    { value: '^\\d+$', success: true, message: 'should validate with escaped string regex' },
    { value: /^[a-z]+$/, success: false, message: 'should invalidate with regex notation', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: new RegExp('^[a-z]+$'), success: false, message: 'should invalidate with RegExp object', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, success: false, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$regex has to be a string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, success: false, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$regex has to be a string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$regex has to be a string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], success: false, message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$regex has to be a string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$regex has to be a string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

const dbTestTable: DbTest[] = [
    { filter: { name: { $regex: '^Compl' } }, success: true, message: 'should validate with $regex "^Compl"' },
    { filter: { name: { $regex: '^compl' } }, success: false, message: 'should not validate with $regex "^compl"' },
    { filter: { name: { $regex: '^compl', $options: 'i' } }, success: true, message: 'should validate with $regex "^compl" & $options "i"' },
    { filter: { name: { $regex: '^b' } }, success: false, message: 'should not validate with $regex "^b"' }
];

describe('filter operators - $regex', () => {
    let mongalayer: Mongalayer, database = globalThis.$mdb.db;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $regex: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) {
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne({
                    property: operator
                }, {});

                expect(result).toBeNull();
            } catch (e) {
                if (!success && isMongoServerError(e)) {
                    expect(e.code).toBe(exceptions?.mongodb?.code);
                    expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
                    expect(e.message).toBe(exceptions?.mongodb?.message);
                } else {
                    throw e;
                }
            }
        });
    });

    describe('on filterTestSolo collection', () => {
        test.each(dbTestTable)('$message', async ({ filter, success, message }) => {
            const zodResult = filterSchema.safeParse(filter);

            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.execute<FilterTest>({
                database: globalThis.$mdb.name,
                collection: "filterTestSolo",
                operation: "findOne",
                payload: {
                    filter
                }
            }, {});

            if (success) {
                expect(mongaResult).toBeDefined();
                expect(mongaResult).toHaveProperty('name', exampleObject1.name);
            } else {
                expect(mongaResult).toBeNull();
            }
        });
    });
});
