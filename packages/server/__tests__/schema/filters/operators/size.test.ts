import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer, MongalayerCollectionType } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';

const valuesTable: ValueTest[] = [
    { value: 123, success: true, message: 'should validate with number' },
    { value: "123", success: false, message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse $size. Expected a number in: $size:" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received string' }
    } },
    { value: true, success: false, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse $size. Expected a number in: $size:" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received boolean' }
    } },
    { value: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse $size. Expected a number in: $size:" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received null' }
    } },
    { value: [], success: false, message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse $size. Expected a number in: $size:" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received array' }
    } },
    { value: {}, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse $size. Expected a number in: $size:" },
        zod: { code: "invalid_type", message: 'Invalid input: expected number, received object' }
    } }
];

const dbTestTable: DbTest[] = [
    { filter: { data: { $size: exampleObject1.data.length } }, success: true, message: 'should validate with $size = data.length' },
    { filter: { data: { $size: exampleObject1.data.length + 1 } }, success: false, message: 'should not validate with $size != data.length + 1' },
];

describe('filter operators - $size', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $size: value };

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
                    expect(e.message).toContain(exceptions?.mongodb?.message);
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

            const mongaResult = await mongalayer.execute({
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
