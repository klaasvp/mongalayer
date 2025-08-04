import { filterOperatorsSchema, filterSchema } from '#src/schema/query';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Mongalayer } from '#src/core';
import { MongalayerCollectionType } from '#src/index.js';

const valuesTable: ValueTest[] = [
    { value: [1, 2, 3], success: true, message: 'should validate with array of numbers' },
    { value: ["a", "b", "c"], success: true, message: 'should validate with array of strings' },
    { value: [true, false], success: true, message: 'should validate with array of booleans' },
    { value: [null, 1, "a", true], success: true, message: 'should validate with mixed array' },
    { value: [[null, 1, "a", true], [2, "B", false]], success: true, message: 'should validate with mixed nested array' },
    { value: [], success: true, message: 'should validate with empty array' },
    { value: [{ a: 1 }, { b: 2 }], success: true, message: 'should validate with array of objects' },
    { value: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$all needs an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received null' }
    } },
    { value: "string", success: false, message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$all needs an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received string' }
    } },
    { value: 123, success: false, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$all needs an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received number' }
    } },
    { value: true, success: false, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$all needs an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received boolean' }
    } },
    { value: {}, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$all needs an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received object' }
    } }
];

const dbTestTable: DbTest[] = [
    { filter: { "details.metadata.tags": { $all: exampleObject1.details.metadata.tags.slice() } }, success: true, message: 'should validate with $all -> exact tags' },
    { filter: { "details.metadata.tags": { $all: ["x", ...exampleObject1.details.metadata.tags.slice()] } }, success: false, message: 'should not validate with $all -> extra tag' },
    { filter: { "details.metadata.tags": { $all: exampleObject1.details.metadata.tags.slice(0, 1) } }, success: true, message: 'should validate with $all -> missing tag' },
    { filter: { "details.metadata.tags": { $all: [] } }, success: false, message: 'should not validate with $all -> no tags' },
    { filter: { "details.nestedObject.property2": { $all: [ exampleObject1.details.nestedObject.property2 ] } }, success: true, message: 'should validate with $all on scalar' },
    { filter: { "details.nestedObject.property2": { $all: [ exampleObject1.details.nestedObject.property1 ] } }, success: false, message: 'should not validate with $all on invalid scalar' }
];

describe('filter operators - $all', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $all: value };

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

            const mongaResult = await mongalayer.executeRaw({
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
