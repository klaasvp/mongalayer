import { Mongalayer } from '#src/core';
import { DbPipelineProjectTest, DbPipelineTest, ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db, Document } from 'mongodb';
import { isMongoServerError } from '#test/lib/helper.js';
import { MongalayerCollectionType } from '#src/index.js';
import { exampleObject1, exampleObject2, FilterTest, getFilterTests } from '#test/data/filterTest.js';
import { pipelineSchema } from '#src/schema/aggregate.js';
import z from 'zod/v4';
import { groupSchema } from '#src/schema/aggregation/group.js';

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 15947, codeName: "Location15947", message: "a group's fields must be specified in an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 15947, codeName: "Location15947", message: "a group's fields must be specified in an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 15947, codeName: "Location15947", message: "a group's fields must be specified in an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 15947, codeName: "Location15947", message: "a group's fields must be specified in an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 15947, codeName: "Location15947", message: "a group's fields must be specified in an object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 15955, codeName: "Location15955", message: "a group specification must include an _id" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "$prop", result: 1 }, message: 'should invalidate with accumulator number', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "$prop", result: "a" }, message: 'should invalidate with accumulator string', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "$prop", result: true }, message: 'should invalidate with accumulator boolean', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "$prop", result: null }, message: 'should invalidate with accumulator null', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "$prop", result: [] }, message: 'should invalidate with accumulator array', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { result: { } }, message: 'should invalidate with empty accumulator object', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { result: { $avg: "$prop" } }, message: 'should invalidate with missing _id', exceptions: {
        mongodb: { code: 15955, codeName: "Location15955", message: "a group specification must include an _id" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: 1, result: { $avg: "$prop" } }, message: 'should invalidate with _id number', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: "a", result: { $avg: "$prop" } }, message: 'should invalidate with _id string', exceptions: {
        zod: { code: 'invalid_format', message: 'Invalid string: must match pattern /^\\$/' }
    } },
    { value: { _id: null, result: { $avg: "$prop" } }, message: 'should validate with _id null', exceptions: {} },
    { value: { _id: true, result: { $avg: "$prop" } }, message: 'should invalidate with _id boolean', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: [], result: { $avg: "$prop" } }, message: 'should invalidate with _id array', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: {}, result: { $avg: "$prop" } }, message: 'should invalidate with _id empty object', exceptions: {} },
    { value: { _id: "$prop", result: { $avg: "$prop" } }, message: 'should validate with _id $path', exceptions: {} },
    { value: { _id: { prop: "$prop" }, result: { $avg: "$prop" } }, message: 'should validate with _id object $path', exceptions: {} },
    { value: { _id: { $invalid: "$prop" }, result: { $avg: "$prop" } }, message: 'should invalidate with _id object invalid operator', exceptions: {
        mongodb: { code: 168, codeName: "InvalidPipelineOperator", message: "Unrecognized expression " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { _id: { prop: "$prop" }, result: { x: { $avg: "$prop" } } }, message: 'should validate with _id object $path', exceptions: {
        mongodb: { code: 40234, codeName: "Location40234", message: "The field 'result' must be an accumulator object" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
];

export type DbGroupTest = { 
    pipeline: z.infer<typeof pipelineSchema>,
    result: Document, 
    message: string 
}

const filterTests = getFilterTests(), lastFilterTest = filterTests.pop()!, firstFilterTest = filterTests.shift()!;

const dbTestTable: DbGroupTest[] = [
    { pipeline: [{ $group: { _id: null, last_id: { $last: "$_id" } } }], result: { _id: null, last_id: lastFilterTest._id }, message: 'group null - $last' },
    { pipeline: [{ $group: { _id: {  }, last_id: { $last: "$_id" } } }], result: { _id: {}, last_id: lastFilterTest._id }, message: 'group {} - $last' },
    { pipeline: [{ $group: { _id: "$groupable", last_id: { $last: "$_id" } } }], result: { _id: lastFilterTest.groupable, last_id: lastFilterTest._id }, message: 'group $groupable -> $last' },
    { pipeline: [{ $group: { _id: { x: "$groupable" }, last_id: { $last: "$_id" } } }], result: { _id:  { x: lastFilterTest.groupable }, last_id: lastFilterTest._id }, message: 'group $x.groupable -> $last' },
    { pipeline: [{ $group: { _id: null, last_id: { $last: "$_id" }, first_id: { $first: "$_id" } } }], result: { _id: null, last_id: lastFilterTest._id, first_id: firstFilterTest._id }, message: 'group null - $last & $first combo' },
];

describe('group', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const zodResult = groupSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{ $match: {} }, { $group: value }]).toArray();

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
        test.each(dbTestTable)('$message', async ({ pipeline, result, message }) => {
            const zodResult = pipelineSchema.safeParse(pipeline);

            expect(zodResult.success).toBe(true);

            const mongaResults = await mongalayer.executeRaw({
                database: dbName,
                collection: "filterTest" as MongalayerCollectionType<FilterTest>,
                operation: "aggregate",
            }, {
                pipeline: [{ $match: {} }, ...pipeline],
                options: {}
            }, {});

            expect(mongaResults).toHaveLength(1);

            for (const mongaResult of mongaResults) {
                expect(mongaResult).toStrictEqual(result);
            }
        });
    });
});
