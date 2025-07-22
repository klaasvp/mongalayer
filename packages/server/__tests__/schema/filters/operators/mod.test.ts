import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, exampleObject2, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: [1, 2], success: true, message: 'should validate with valid tuple [1, 2]' },
    { value: [10, 5], success: true, message: 'should validate with valid tuple [10, 5]' },
    { value: [5, 0], success: true, message: 'should validate with valid tuple [5, 0]' },
    { value: [0, 5], success: false, message: 'should validate with valid tuple [0, 5]', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "divisor cannot be 0" },
        zod: { code: "too_small", message: 'Too small: expected number to be >=1' }
    }  },
    { value: [1, '2'], success: false, message: 'should invalidate with string as remainder ', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, remainder not a number" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received string' }
    } },
    { value: ['2', 1], success: false, message: 'should invalidate with string as divisor', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, divisor not a number" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received string' }
    } },
    { value: 1, success: false, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, needs to be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected tuple, received number' }
    } },
    { value: 'invalid', success: false, message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, needs to be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected tuple, received string' }
    } },
    { value: { }, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, needs to be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected tuple, received object' }
    } },
    { value: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, needs to be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected tuple, received null' }
    } },
    { value: [1], success: false, message: 'should invalidate with single element array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, not enough elements" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received undefined' }
    } },
    { value: [1, 2, 3], success: false, message: 'should invalidate with array of more than 2 elements', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "malformed mod, too many elements" },
        zod: { code: "too_big", message: 'Too big: expected array to have <2 items' }
    } },
];

const dbTestTable: DbTest[] = [
    { filter: { "details.nestedObject.property2": { $mod: [10, 3] } }, success: true, message: 'should validate with $mod [10, 3]' },
    { filter: { "details.nestedObject.property2": { $mod: [5, 2] } }, success: false, message: 'should not validate with $mod [5, 2]' }
];

describe('filter operators - $mod', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $mod: value };

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

                if (success) {
                    expect(result).toBeNull();
                } else {
                    throw "mongalayer.execute should have thrown an error";
                }
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
                database: dbName,
                collection: "filterTestSolo",
                operation: "findOne",
                payload: {
                    filter
                }
            }, {});

            if (success) {
                expect(mongaResult).toBeDefined();
                expect(mongaResult).toHaveProperty('details.nestedObject.property2', exampleObject1.details.nestedObject.property2);
            } else {
                expect(mongaResult).toBeNull();
            }
        });
    });
});
