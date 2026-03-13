import { Mongalayer } from '#src/core';
import { DbPipelineProjectTest, DbPipelineTest, ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { isMongoServerError } from '#test/lib/helper.js';
import { MongalayerCollectionType } from '#src/index.js';
import { exampleObject1, exampleObject2, FilterTest } from '#test/data/filterTest.js';
import { pipelineSchema } from '#src/schema/aggregate.js';
import { unwindSchema } from '#src/schema/aggregation/unwind.js';
import z from 'zod';

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 15981, codeName: "Location15981", message: "expected either a string or an object as specification for $unwind stage" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: "$prop", message: 'should validate with path string', exceptions: {} },
    { value: "a", message: 'should invalidate with non-path string', exceptions: {
        mongodb: { code: 28818, codeName: "Location28818", message: "path option to $unwind stage should be prefixed with a '$'" },
        zod: { code: 'invalid_format', message: 'Invalid string: must match pattern /^\\$/' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 15981, codeName: "Location15981", message: "expected either a string or an object as specification for $unwind stage" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 15981, codeName: "Location15981", message: "expected either a string or an object as specification for $unwind stage" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 15981, codeName: "Location15981", message: "expected either a string or an object as specification for $unwind stage" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 28812, codeName: "Location28812", message: "no path specified to $unwind stage" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $avg: 1 }, message: 'should invalidate with root operator', exceptions: {
        mongodb: { code: 28811, codeName: "Location28811", message: "unrecognized option to $unwind stage: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { path: "$prop" }, message: 'should validate with obj path', exceptions: {} },
    { value: { path: "a" }, message: 'should invalidate with obj non-path', exceptions: {
        mongodb: { code: 28818, codeName: "Location28818", message: "path option to $unwind stage should be prefixed with a '$'" },
        zod: { code: 'invalid_format', message: 'Invalid string: must match pattern /^\\$/' }
    } },
    { value: { path: "$prop", includeArrayIndex: "a" }, message: 'should validate with includeArrayIndex', exceptions: {} },
    { value: { path: "$prop", includeArrayIndex: 1 }, message: 'should invalidate with includeArrayIndex number', exceptions: {
        mongodb: { code: 28810, codeName: "Location28810", message: "expected a non-empty string for the includeArrayIndex  option to $unwind stage, " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { path: "$prop", preserveNullAndEmptyArrays: true }, message: 'should validate with preserveNullAndEmptyArrays', exceptions: {} },
    { value: { path: "$prop", preserveNullAndEmptyArrays: 1 }, message: 'should invalidate with preserveNullAndEmptyArrays number', exceptions: {
        mongodb: { code: 28809, codeName: "Location28809", message: "expected a boolean for the preserveNullAndEmptyArrays option to $unwind stage, " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { path: "$prop", includeArrayIndex: "a", preserveNullAndEmptyArrays: true }, message: 'should validate with includeArrayIndex & preserveNullAndEmptyArrays', exceptions: {} },
];

export type DbUnwindTest = { 
    pipeline: z.infer<typeof pipelineSchema>,
    length: number,
    properties: {
        present: (string | {prop: string, value: any})[],
        missing: string[]
    }, 
    message: string 
}

const dbTestTable: DbUnwindTest[] = [
    { pipeline: [{$unwind: "$data" }], length: exampleObject1.data.length + exampleObject2.data.length, properties: { present: [], missing: [] }, message: 'string path' },
    { pipeline: [{$unwind: { path: "$data" } }], length: exampleObject1.data.length + exampleObject2.data.length, properties: { present: [], missing: [] }, message: 'obj path' },
    { pipeline: [{$unwind: { path: "$data", includeArrayIndex: "a" } }], length: exampleObject1.data.length + exampleObject2.data.length, properties: { present: ["a"], missing: [] }, message: 'obj path & index' },
];

describe('unwind', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const zodResult = unwindSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{ $match: {} }, { $unwind: value }]).toArray();

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
        test.each(dbTestTable)('$message', async ({ pipeline, length, properties, message }) => {
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
