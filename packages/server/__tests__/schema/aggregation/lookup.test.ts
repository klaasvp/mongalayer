import { Mongalayer } from '#src/core';
import { ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { isMongoServerError } from '#test/lib/helper.js';
import { MongalayerCollectionType } from '#src/index.js';
import { FilterTest } from '#test/data/filterTest.js';
import { pipelineSchema } from '#src/schema/aggregate.js';
import { lookupSchema } from '#src/schema/aggregation/lookup.js';
import z from 'zod';

const validLookup = { from: "filterTest", localField: "groupable", foreignField: "groupable", as: "joined" };

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "the $lookup stage specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "the $lookup stage specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "the $lookup stage specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "the $lookup stage specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "the $lookup stage specification must be an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "must specify 'pipeline' when 'from' is empty" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }
    } },
    { value: validLookup, message: 'should validate with all fields', exceptions: {} },
    { value: { localField: "groupable", foreignField: "groupable", as: "joined" }, message: 'should invalidate with missing from', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "must specify 'pipeline' when 'from' is empty" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }
    } },
    { value: { from: "filterTest", foreignField: "groupable", as: "joined" }, message: 'should invalidate with missing localField', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup requires either 'pipeline' or both 'localField' and 'foreignField' to be specified" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }
    } },
    { value: { from: "filterTest", localField: "groupable", as: "joined" }, message: 'should invalidate with missing foreignField', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup requires either 'pipeline' or both 'localField' and 'foreignField' to be specified" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }
    } },
    { value: { from: "filterTest", localField: "groupable", foreignField: "groupable" }, message: 'should invalidate with missing as', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "must specify 'as' field for a $lookup" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }
    } },
    { value: { ...validLookup, from: 1 }, message: 'should invalidate with non-string from', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup 'from' field must be a string" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received number' }
    } },
    { value: { ...validLookup, localField: 1 }, message: 'should invalidate with non-string localField', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup argument 'localField' must be a string" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received number' }
    } },
    { value: { ...validLookup, foreignField: 1 }, message: 'should invalidate with non-string foreignField', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup argument 'foreignField' must be a string" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received number' }
    } },
    { value: { ...validLookup, as: 1 }, message: 'should invalidate with non-string as', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "$lookup argument 'as' must be a string" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected string, received number' }
    } },
    { value: { ...validLookup, extra: "x" }, message: 'should invalidate with unknown field', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: "unknown argument to $lookup: extra" },
        zod: { code: 'unrecognized_keys', message: 'Unrecognized key: "extra"' }
    } },
];

export type DbLookupTest = {
    pipeline: z.infer<typeof pipelineSchema>,
    length: number,
    lookupLength: number,
    properties: {
        present: (string | { prop: string, value: any })[],
        missing: string[]
    },
    message: string
}

const dbTestTable: DbLookupTest[] = [
    { pipeline: [{ $lookup: { from: "filterTest", localField: "name", foreignField: "name", as: "joined" } }], length: 2, lookupLength: 1, properties: { present: ["joined"], missing: [] }, message: 'self lookup' },
    { pipeline: [{ $lookup: { from: "filterTest", localField: "groupable", foreignField: "noMatch", as: "joined" } }], length: 2, lookupLength: 0, properties: { present: ["joined"], missing: [] }, message: 'lookup with no matches' },
];

describe('lookup', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const zodResult = lookupSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{ $match: {} }, { $lookup: value }]).toArray();

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
                } else {
                    throw e;
                }
            }
        });
    });

    describe('on filterTest collection', () => {
        test.each(dbTestTable)('$message', async ({ pipeline, length, lookupLength, properties, message }) => {
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

            expect(mongaResult).toHaveLength(length);

            for (const result of mongaResult) {
                expect(result.joined).toHaveLength(lookupLength);

                properties.present.forEach((property) => {
                    if (typeof property === "string") {
                        expect(result).toHaveProperty(property);
                    } else {
                        const { prop, value } = property;

                        expect(result).toHaveProperty(prop);
                        expect(result[prop]).toStrictEqual(value);
                    }
                });
                properties.missing.forEach((property) => {
                    expect(result).not.toHaveProperty(property);
                });
            }
        });
    });
});
