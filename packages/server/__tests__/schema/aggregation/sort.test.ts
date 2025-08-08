import { sortSchema } from '#src/schema/aggregation/sort';
import { Mongalayer } from '#src/core';
import { FilterTest } from '#test/data/filterTest';
import { ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import z from 'zod';
import { MongalayerCollectionType } from '#src/index.js';
import { isMongoInvalidArgumentError, isMongoServerError } from '#test/lib/helper.js';
import { pipelineSchema } from '#src/schema/aggregate.js';

export type DbSortTest = { 
    pipeline: [{$sort: z.infer<typeof sortSchema>}],
    firstID: string,
    message: string 
}

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 15973, codeName: "Location15973", message: "the $sort key specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 15973, codeName: "Location15973", message: "the $sort key specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 15973, codeName: "Location15973", message: "the $sort key specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 15973, codeName: "Location15973", message: "the $sort key specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 15973, codeName: "Location15973", message: "the $sort key specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 15976, codeName: "Location15976", message: "$sort stage must have at least one sort key" },
        zod: { code: 'custom', message: 'Invalid input' }
    } },
    { value: { prop: 1 }, message: 'should validate with prop -> 1', exceptions: {} },
    { value: { prop: -1 }, message: 'should validate with prop -> -1', exceptions: {} },
    { value: { prop: 0 }, message: 'should invalidate with prop -> 0', exceptions: { 
        mongodb: { code: 15975, codeName: "Location15975", message: "$sort key ordering must be 1 (for ascending) or -1 (for descending)" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: 2 }, message: 'should invalidate with prop -> 2', exceptions: { 
        mongodb: { code: 15975, codeName: "Location15975", message: "$sort key ordering must be 1 (for ascending) or -1 (for descending)" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: -2 }, message: 'should invalidate with prop -> -2', exceptions: { 
        mongodb: { code: 15975, codeName: "Location15975", message: "$sort key ordering must be 1 (for ascending) or -1 (for descending)" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: 1, prop2: -1 }, message: 'should validate with sort combination', exceptions: {} },
    { value: { nested: { prop: 1 } }, message: 'should invalidate with nested prop -> 1', exceptions: {
        mongodb: { code: 17312, codeName: "Location17312", message: "$meta is the only expression supported by $sort right now" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { "nested.prop": 1 }, message: 'should validate with nested.prop -> 1', exceptions: {} },
    { value: { prop: "a" }, message: 'should invalidate with prop -> string', exceptions: {
        mongodb: { code: 15974, codeName: "Location15974", message: "Illegal key in $sort specification: prop: \"a\"" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: true }, message: 'should invalidate with prop -> boolean', exceptions: {
        mongodb: { code: 15974, codeName: "Location15974", message: "Illegal key in $sort specification: prop: true" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: null }, message: 'should invalidate with prop -> null', exceptions: {
        mongodb: { code: 15974, codeName: "Location15974", message: "Illegal key in $sort specification: prop: null" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: [] }, message: 'should invalidate with prop -> array', exceptions: {
        mongodb: { code: 15974, codeName: "Location15974", message: "Illegal key in $sort specification: prop: []" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: {} }, message: 'should invalidate with prop -> object', exceptions: {
        mongodb: { code: 17312, codeName: "Location17312", message: "$meta is the only expression supported by $sort right now" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
];

const dbTestTable: DbSortTest[] = [
    { pipeline: [{ $sort: { name: 1 } }], firstID: "a", message: 'string ascending' },
    { pipeline: [{ $sort: { name: -1 } }], firstID: "b", message: 'string descending' },
    { pipeline: [{ $sort: { "details.metadata.createdAt": 1 } }], firstID: "a", message: 'date ascending' },
    { pipeline: [{ $sort: { "details.metadata.createdAt": -1 } }], firstID: "b", message: 'date descending' },
    { pipeline: [{ $sort: { "details.metadata.updatedAt": 1 } }], firstID: "a", message: 'date string ascending' },
    { pipeline: [{ $sort: { "details.metadata.updatedAt": -1 } }], firstID: "b", message: 'date string descending' },
    { pipeline: [{ $sort: { flags: 1 } }], firstID: "b", message: 'number ascending' },
    { pipeline: [{ $sort: { flags: -1 } }], firstID: "a", message: 'number descending' },
    { pipeline: [{ $sort: { name: 1, flags: 1 } }], firstID: "a", message: 'combined ascending' },
    { pipeline: [{ $sort: { name: -1, flags: -1 } }], firstID: "b", message: 'combined descending' },
    { pipeline: [{ $sort: { flags: 1, name: 1 } }], firstID: "b", message: 'combined reverse ascending' },
    { pipeline: [{ $sort: { flags: -1, name: -1 } }], firstID: "a", message: 'combined reverse descending' },
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
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{ $match: {} }, { $sort: value }]).toArray();

                if (exceptions?.mongodb) {
                    throw "mongalayer.execute should have thrown an error";
                } else {
                    expect(result).toHaveLength(0);
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
        test.each(dbTestTable)('$message', async ({ pipeline, firstID, message }) => {
                const zodResult = pipelineSchema.safeParse(pipeline);

            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.executeRaw({
                database: dbName,
                collection: "filterTest" as MongalayerCollectionType<FilterTest>,
                operation: "aggregate",
            }, {
                pipeline: [{ $match: {} }, ...pipeline],
                options: {}
            }, {});

            expect(mongaResult).toBeDefined();
            expect(mongaResult).toHaveLength(2);
            expect(mongaResult[0]._id).toBe(firstID);
        });
    });
});
