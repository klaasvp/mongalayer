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
import { pipelineSchema, limitSchema } from '#src/schema/aggregate.js';

export type DbLimitTest = { 
    pipeline: z.infer<typeof pipelineSchema>,
    length: number,
    message: string 
}

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should validate with number > 0', exceptions: {} },
    { value: 2, message: 'should validate with number > 1', exceptions: {} },
    { value: 0, message: 'should invalidate with number = 0', exceptions: {
        mongodb: { code: 15958, codeName: "Location15958", message: "the limit must be positive" },
        zod: { code: 'too_small', message: 'Too small: expected number to be >0' }    
    } },
    { value: -1, message: 'should invalidate with number < 0', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a non-negative number in" },
        zod: { code: 'too_small', message: 'Too small: expected number to be >0' }        
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a number in:" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a number in:" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a number in:" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a number in:" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 5107201, codeName: "Location5107201", message: "invalid argument to $limit stage: Expected a number in:" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received object' }
    } },
];

const dbTestTable: DbLimitTest[] = [
    { pipeline: [{ $limit: 1 }], length: 1, message: 'limit 1' },
    { pipeline: [{ $limit: 2 }], length: 2, message: 'limit 2 (all)' },
    { pipeline: [], length: 2, message: 'no limit' },
];

describe('limit', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const zodResult = limitSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{ $match: {} }, { $limit: value }]).toArray();

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
        test.each(dbTestTable)('$message', async ({ pipeline, length, message }) => {
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
            expect(mongaResult).toHaveLength(length);
        });
    });
});
