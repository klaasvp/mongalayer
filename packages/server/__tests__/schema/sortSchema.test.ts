import { projectionSchema, sortSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { FilterTest } from '#test/data/filterTest';
import { DbProjectTest, isMongoInvalidArgumentError, isMongoServerError, ValueTest } from './filters/helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import z from 'zod';
import { MongalayerCollectionType } from '#src/index.js';

export type DbSortTest = { 
    sort: z.infer<typeof sortSchema>,
    firstID: string,
    message: string 
}

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongoapi: { message: "Invalid sort format: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        //mongodb: { code: 14, codeName: "TypeMismatch", message: "Expected field projectionto be of type object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongoapi: { message: "Invalid sort format: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "Expected field projectionto be of type object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "Expected field projectionto be of type object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received array' }
    } },
    { value: {}, message: 'should validate with empty object', exceptions: {} },
    { value: { prop: 1 }, message: 'should validate with prop -> 1', exceptions: {} },
    { value: { prop: -1 }, message: 'should validate with prop -> -1', exceptions: {} },
    { value: { prop: 0 }, message: 'should invalidate with prop -> 0', exceptions: { 
        mongoapi: { message: "Invalid sort direction: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: 2 }, message: 'should invalidate with prop -> 0', exceptions: { 
        mongoapi: { message: "Invalid sort direction: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: -2 }, message: 'should invalidate with prop -> 0', exceptions: { 
        mongoapi: { message: "Invalid sort direction: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: 1, prop2: -1 }, message: 'should validate with sort combination', exceptions: {} },
    { value: { nested: { prop: 1 } }, message: 'should invalidate with nested prop -> 1', exceptions: {
        mongoapi: { message: "Invalid sort direction: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { "nested.prop": 1 }, message: 'should validate with nested.prop -> 1', exceptions: {} },
    { value: { prop: "a" }, message: 'should invalidate with prop -> string', exceptions: {
        mongoapi: { message: "Invalid sort direction: \"a\"" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: true }, message: 'should invalidate with prop -> boolean', exceptions: {
        mongoapi: { message: "Invalid sort direction: true" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: null }, message: 'should invalidate with prop -> null', exceptions: {
        mongoapi: { message: "Invalid sort direction: null" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: [] }, message: 'should invalidate with prop -> array', exceptions: {
        mongoapi: { message: "Invalid sort direction: []" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: {} }, message: 'should invalidate with prop -> object', exceptions: {
        mongoapi: { message: "Invalid sort direction: {}" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
];

const dbTestTable: DbSortTest[] = [
    { sort: { name: 1 }, firstID: "a", message: 'string ascending' },
    { sort: { name: -1 }, firstID: "b", message: 'string descending' },
    { sort: { "details.metadata.createdAt": 1 }, firstID: "a", message: 'date ascending' },
    { sort: { "details.metadata.createdAt": -1 }, firstID: "b", message: 'date descending' },
    { sort: { "details.metadata.updatedAt": 1 }, firstID: "a", message: 'date string ascending' },
    { sort: { "details.metadata.updatedAt": -1 }, firstID: "b", message: 'date string descending' },
    { sort: { flags: 1 }, firstID: "b", message: 'number ascending' },
    { sort: { flags: -1 }, firstID: "a", message: 'number descending' },
    { sort: { name: 1, flags: 1 }, firstID: "a", message: 'combined ascending' },
    { sort: { name: -1, flags: -1 }, firstID: "b", message: 'combined descending' },
    { sort: { flags: 1, name: 1 }, firstID: "b", message: 'combined reverse ascending' },
    { sort: { flags: -1, name: -1 }, firstID: "a", message: 'combined reverse descending' },
];

describe('sort', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const zodResult = sortSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne({}, { sort: value });

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
                } else if (exceptions?.mongoapi && isMongoInvalidArgumentError(e)) {
                    expect(e.message).toContain(exceptions?.mongoapi?.message);
                } else {
                    throw e;
                }
            }
        });
    });

    describe('on filterTest collection', () => {
        test.each(dbTestTable)('$message', async ({ sort, firstID, message }) => {
            const zodResult = sortSchema.safeParse(sort);

            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.executeRaw({
                database: dbName,
                collection: "filterTest" as MongalayerCollectionType<FilterTest>,
                operation: "find",
            }, {
                filter: {},
                options: {
                    sort
                }
            }, {});

            expect(mongaResult).toBeDefined();
            expect(mongaResult).toHaveLength(2);
            expect(mongaResult[0]._id).toBe(firstID);
        });
    });
});
