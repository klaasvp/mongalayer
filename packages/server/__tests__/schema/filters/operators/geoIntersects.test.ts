import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] } }, message: 'should validate with valid polygon', exceptions: {} },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [3 ,6], [6, 1], [0, 0]], [[2, 2], [3, 3], [4, 2], [2, 2]]] } }, message: 'should validate with valid multi ring polygon', exceptions: {} },
    // Note, there's not validation in Mongalayer to check contained holes inside a polygon
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]], [[2, 2], [3, 3], [3, 2], [2, 2]]] } }, message: 'should invalidate with invalid multi ring polygon', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Secondary loops not contained by first exterior loop - secondary loops must be holes:" },
    } },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]],
        crs: {
            type: "name",
            properties: { name: "urn:x-mongodb:crs:strictwinding:EPSG:4326" }
        } 
    } }, message: 'should validate with valid polygon & crs', exceptions: {} },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]],
        crs: {
            type: "x",
            properties: { name: "urn:x-mongodb:crs:strictwinding:EPSG:4326" }
        } 
    } }, message: 'should invalidate with invalid crs ', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: `GeoJSON CRS must have field "type": "name"` },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 1], [1, 0], [0, 0]]], [[[2, 2], [3, 3], [3, 2], [2, 2]]]] } }, message: 'should validate with valid multi-polygon', exceptions: {} },
    { value: { $geometry: { type: "LineString", coordinates: [[0, 0], [1, 1], [1, 0]] } }, message: 'should validate with LineString', exceptions: {} },
    { value: { $geometry: { type: "MultiLineString", coordinates: [[[0, 0], [1, 1], [1, 0]], [[2, 2], [3, 3], [3, 2]]] } }, message: 'should validate with MultiLineString', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] } }, message: 'should validate with Point', exceptions: {} },
    { value: { $geometry: { type: "GeometryCollection", geometries: [
        { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] },
        { type: "Point", coordinates: [0, 0] }
    ] } }, message: 'should validate with GeometryCollection', exceptions: {} },
    { value: { $geometry: [0, 0] }, message: 'should validate with legacy coordinates', exceptions: {} },
    { value: { $geometry: { type: "Polygon", coordinates: [] } }, message: 'should invalidate with empty coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Polygon has no loops." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 0]]] } }, message: 'should invalidate with invalid polygon (< 3 coordinates)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Loop must have at least 3 different vertices, " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0]]] } }, message: 'should invalidate with invalid polygon (not closed)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Loop is not closed, first vertex does not equal last vertex: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: {} }, message: 'should invalidate with empty geometry object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown GeoJSON type: {}" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: [] }, message: 'should invalidate with empty geometry legacy coordinates array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received number' }
    } },
    { value: "invalid", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_type", message: 'Invalid input: expected object, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geo query doesn't have any geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];

const dbTestTable: DbTest[] = [
    { filter: { point: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects polygon' },
    { filter: { point: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: [[[20, 20], [22, 22], [22, 21], [20, 20]]] } } } }, success: false, message: 'should not validate with $geoIntersects polygon (no intersection)' },
    { filter: { multiPoint: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects multi-point' },
    { filter: { lineString: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects line string' },
    { filter: { multiLineString: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects multi-line string' },
    { filter: { polygon: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects polygon' },
    { filter: { multiPolygon: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects multi-polygon' },
    { filter: { geometryCollection: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects geometry collection' },
    { filter: { coordinates: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoIntersects coordinates' },
    { filter: { extra: { $geoIntersects: { $geometry: exampleObject1.polygon } } }, success: false, message: 'should invalidate on random property' }
];

describe('filter operators - $geoIntersects', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $geoIntersects: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
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

            const mongaResult = await mongalayer.execute<FilterTest>({
                database: dbName,
                collection: "filterTestSolo",
                operation: "findOne",
                payload: {
                    filter
                }
            }, {});

            if (success) {
                expect(mongaResult).toBeDefined();
                expect(mongaResult).toHaveProperty('name', exampleObject1.name);
            } else {
                expect(mongaResult).toBeNull();
            }
        });
    });
});
