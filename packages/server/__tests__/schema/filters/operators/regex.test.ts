import { filterOperatorsSchema, filterSchema } from '#src/schema/query';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { MongalayerCollectionType } from '#src/index.js';

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
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
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

            const mongaResult = await mongalayer.executeRaw({
                database: dbName,
                collection: "filterTestSolo" as MongalayerCollectionType<FilterTest>,
                operation: "findOne"
                }, { filter }, {});

            if (success) {
                expect(mongaResult).toBeDefined();
                expect(mongaResult).toHaveProperty('name', exampleObject1.name);
            } else {
                expect(mongaResult).toBeNull();
            }
        });
    });
});
