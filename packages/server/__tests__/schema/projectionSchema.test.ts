import { projectionSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { FilterTest } from '#test/data/filterTest';
import { DbProjectTest, isMongoServerError, ValueTest } from './filters/helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { MongalayerCollectionType } from '#src/index.js';

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: "Expected field projectionto be of type object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: "Expected field projectionto be of type object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected record, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: "Expected field projectionto be of type object" },
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
    { value: { prop: 0 }, message: 'should validate with prop -> 0', exceptions: {} },
    { value: { prop: 2 }, message: 'should invalidate with prop -> 2', exceptions: { 
        //mongodb: { code: 2, codeName: "BadValue", message: "" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: 1, prop2: 1 }, message: 'should validate with all inclusion - number', exceptions: {} },
    { value: { prop: 1, prop2: 0 }, message: 'should invalidate with inclusion & exclusion - number', exceptions: {
        mongodb: { code: 31254, codeName: "Location31254", message: "Cannot do exclusion on field " },
        zod: { code: 'invalid_value', message: 'Projection cannot mix inclusion and exclusion.' }
    } },
    { value: { prop: 1, _id: 0 }, message: 'should validate with inclusion & exclusion of _id (last) - number', exceptions: {} },
    { value: { _id: 0, prop: 1 }, message: 'should validate with inclusion & exclusion of _id (first) - number', exceptions: {} },
    { value: { prop: 0, prop2: 0 }, message: 'should validate with all exclusion - number', exceptions: {} },
    { value: { prop: 0, prop2: 1 }, message: 'should invalidate with exclusion & inclusion - number', exceptions: {
        mongodb: { code: 31253, codeName: "Location31253", message: "Cannot do inclusion on field " },
        zod: { code: 'invalid_value', message: 'Projection cannot mix inclusion and exclusion.' }
    } },
    { value: { prop: 0, _id: 1 }, message: 'should validate with exclusion & inclusion of _id - number', exceptions: {} },
    { value: { prop: true }, message: 'should validate with prop -> true', exceptions: {} },
    { value: { prop: false }, message: 'should validate with prop -> false', exceptions: {} },
    { value: { prop: true, prop2: true }, message: 'should validate with all inclusion - boolean', exceptions: {} },
    { value: { prop: true, prop2: false }, message: 'should invalidate with inclusion & exclusion - boolean', exceptions: {
        mongodb: { code: 31254, codeName: "Location31254", message: "Cannot do exclusion on field " },
        zod: { code: 'invalid_value', message: 'Projection cannot mix inclusion and exclusion.' }
    } },
    { value: { prop: true, _id: false }, message: 'should validate with inclusion & exclusion of _id - boolean', exceptions: {} },
    { value: { prop: false, prop2: false }, message: 'should validate with all exclusion - boolean', exceptions: {} },
    { value: { prop: false, prop2: true }, message: 'should invalidate with exclusion & inclusion - boolean', exceptions: {
        mongodb: { code: 31253, codeName: "Location31253", message: "Cannot do inclusion on field " },
        zod: { code: 'invalid_value', message: 'Projection cannot mix inclusion and exclusion.' }
    } },
    { value: { prop: false, _id: true }, message: 'should validate with exclusion & inclusion of _id - boolean', exceptions: {} },
    { value: { nested: { prop: 0 } }, message: 'should validate with nested prop -> 0', exceptions: {} },
    { value: { nested: { prop: 1, prop2: 0 } }, message: 'should invalidate with nested inclusion & exclusion - number', exceptions: {
        mongodb: { code: 31254, codeName: "Location31254", message: "Cannot do exclusion on field " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { nested: { prop: 2 } }, message: 'should invalidate with nested prop -> 2', exceptions: { 
        //mongodb: { code: 2, codeName: "BadValue", message: "" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { nested: { prop: true } }, message: 'should validate with nested prop -> true', exceptions: {} },
    { value: { nested: { prop: false } }, message: 'should validate with nested prop -> false', exceptions: {} },
    { value: { "nested.prop": 1 }, message: 'should validate with nested.prop -> 1', exceptions: {} },
    { value: { prop: "a" }, message: 'should invalidate with prop -> string', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: null }, message: 'should invalidate with prop -> null', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { prop: [] }, message: 'should invalidate with prop -> array', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
];

const dbTestTable: DbProjectTest[] = [
    { projection: { name: 1 }, properties: { present: [ "_id", "name" ], missing: [] }, message: 'include name' },
    { projection: { name: 0 }, properties: { present: [ "_id" ], missing: [ "name" ] }, message: 'exclude name' },
    { projection: { name: 1, _id: 0 }, properties: { present: [ "name" ], missing: [ "_id" ] }, message: 'include name, exclude _id' },
    { projection: { _id: 0, name: 1 }, properties: { present: [ "name" ], missing: [ "_id" ] }, message: 'exclude _id, include name' },
    { projection: { "details.description": 1 }, properties: { present: [ "_id", "details.description" ], missing: [ "details.metadata" ] }, message: 'include details.description - dot notation' },
    { projection: { "details.description": 1, "details.metadata": 1 }, properties: { present: [ "_id", "details.description", "details.metadata" ], missing: [  ] }, message: 'include details.description & details.metadata - dot notation' },
    { projection: { details: { description: 1 } }, properties: { present: [ "_id", "details.description" ], missing: [ "details.metadata" ] }, message: 'include details.description - object notation' },
    { projection: { details: { description: 1, metadata: 1 } }, properties: { present: [ "_id", "details.description", "details.metadata" ], missing: [  ] }, message: 'include details.description & details.metadata - object notation' },
    { projection: { "details.nestedObject": 0 }, properties: { present: [ "_id", "details.description", "details.metadata" ], missing: [ "details.nestedObject" ] }, message: 'exclude details.nestedObject - dot notation' },
    { projection: { details: { nestedObject: 0 } }, properties: { present: [ "_id", "details.description", "details.metadata" ], missing: [ "details.nestedObject" ] }, message: 'exclude details.nestedObject - object notation' },
];

describe('projection', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const zodResult = projectionSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne({}, { projection: value });

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
        test.each(dbTestTable)('$message', async ({ projection, properties, message }) => {
            const zodResult = projectionSchema.safeParse(projection);

            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.executeRaw({
                database: dbName,
                collection: "filterTestSolo" as MongalayerCollectionType<FilterTest>,
                operation: "findOne",
            }, {
                filter: {},
                options: {
                    projection
                }
            }, {});

            expect(mongaResult).toBeDefined();

            properties.present.forEach((property) => {
                expect(mongaResult).toHaveProperty(property);
            });
            properties.missing.forEach((property) => {
                expect(mongaResult).not.toHaveProperty(property);
            });
        });
    });
});
