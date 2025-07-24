import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { Mongalayer, MongalayerCollectionType } from '#src/core';

const valuesTable: ValueTest[] = [
    { value: { name: "test" }, message: 'should validate with valid query object', exceptions: {} },
    { value: { age: { $gt: 18 } }, message: 'should validate with nested operator', exceptions: {} },
    { value: { $gt: 18 }, message: 'should validate with operator', exceptions: {} },
    // We won't support directly nested $elemMatch operators
    { value: { $elemMatch: { name: "test" } }, message: 'should not validate with direct $elemMatch + object', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $or: [{ $eq: 123 }] }, message: 'should not validate with operator in $or', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown top level operator:" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $or: [{ prop: { $eq: 123 } }] }, message: 'should validate with operator on prop in $or', exceptions: {} },
    { value: { $and: [{ prop: { $eq: 123 } }] }, message: 'should validate with operator on prop in $and', exceptions: {} },
    { value: { $nor: [{ prop: { $eq: 123 } }] }, message: 'should validate with operator on prop in $nor', exceptions: {} },
    { value: { $text: { $search: "x" } }, message: 'should not validate with operator $text', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$text can only be applied to the top-level document" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $where: "x" }, message: 'should not validate with operator $where', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$where can only be applied to the top-level document" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "string", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$elemMatch needs an Object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

const dbTestTable: DbTest[] = [
    { filter: { "details.metadata.tags": { $elemMatch: { $eq: "example" } } }, success: true, message: 'should validate with $elemMatch on array - $eq "example"' },
    { filter: { "details.metadata.tags": { $elemMatch: { $eq: "abc" } } }, success: false, message: 'should not validate with $elemMatch on array - $eq "abc"' },
    { filter: { data: { $elemMatch: { value: { $eq: "value1" } } } }, success: true, message: 'should validate with $elemMatch on object array - $eq "value1"' },
    { filter: { data: { $elemMatch: { value: { $eq: "abc" } } } }, success: false, message: 'should not validate with $elemMatch on object array - $eq "abc"' },
    { filter: { data: { $elemMatch: { value: "value1" } } }, success: true, message: 'should validate with $elemMatch on object array - = "value1"' },
    { filter: { data: { $elemMatch: { value: "abc" } } }, success: false, message: 'should not validate with $elemMatch on object array - = "abc"' }
];

describe('filter operators - $elemMatch', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $elemMatch: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne({
                    property: operator
                }, {});

                if (exceptions?.mongodb) {
                    throw "mongalayer.execute should have thrown an error";
                } else {
                    expect(result).toBeNull();
                }
            } catch (e) {
                if (exceptions?.mongodb && isMongoServerError(e)) {
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
