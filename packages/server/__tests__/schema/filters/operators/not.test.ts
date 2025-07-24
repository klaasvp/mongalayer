import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer, MongalayerCollectionType } from '#src/core';
import { exampleObject1, exampleObject2, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: { $eq: 42 }, success: true, message: 'should validate with $eq' },
    { value: { $in: [10] }, success: true, message: 'should validate with $in' },
    { value: { $invalid: 42 }, success: false, message: 'should invalidate with invalid operator', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown operator: " },
        zod: { code: "custom", message: 'Invalid filter operator' }
    }  },
    { value: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$not argument must be a regex or an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received null' }
    }  },
    { value: { $not: 42 }, success: false, message: 'should invalidate with nested $not', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$not argument must be a regex or an object" },
        zod: { code: "custom", message: 'Invalid filter operator' }
    } },
];

const dbTestTable: DbTest[] = [
    { filter: { name: { $not: { $eq: exampleObject2.name } } }, success: true, message: 'should validate with $not $eq' },
    { filter: { name: { $not: { $eq: exampleObject1.name } } }, success: false, message: 'should not validate with $not $eq' }
];

describe('filter operators - $not', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $not: value };

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
                    if (exceptions && exceptions.mongodb) {
                        expect(e.code).toBe(exceptions.mongodb.code);
                        expect(e.codeName).toBe(exceptions.mongodb.codeName);
                        expect(e.message.startsWith(exceptions.mongodb.message)).toBe(true);
                    } else {    
                        expect(e.code).toBe(2);
                        expect(e.codeName).toBe('BadValue');
                        expect(e.message).toBe("");
                    }
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
