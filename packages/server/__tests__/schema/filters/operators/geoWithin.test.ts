import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { MongalayerCollectionType } from '#src/index.js';

const valuesTable: ValueTest[] = [
    // Test with $geometry
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] } }, message: 'should validate with valid polygon', exceptions: {} },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [3, 6], [6, 1], [0, 0]], [[2, 2], [3, 3], [4, 2], [2, 2]]] } }, message: 'should validate with valid multi-ring polygon', exceptions: {} },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]], [[2, 2], [3, 3], [3, 2], [2, 2]]] } }, message: 'should invalidate with invalid multi-ring polygon', exceptions: {
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
    { value: { $geometry: { type: "LineString", coordinates: [[0, 0], [1, 1], [1, 0]] } }, message: 'should invalidate with LineString', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$within not supported with provided geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "MultiLineString", coordinates: [[[0, 0], [1, 1], [1, 0]], [[2, 2], [3, 3], [3, 2]]] } }, message: 'should invalidate with MultiLineString', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$within not supported with provided geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] } }, message: 'should invalidate with Point', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$within not supported with provided geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "GeometryCollection", geometries: [
        { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] },
        { type: "Point", coordinates: [0, 0] }
    ] } }, message: 'should validate with GeometryCollection', exceptions: {} },
    { value: { $geometry: [0, 0] }, message: 'should invalidate with legacy coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$within not supported with provided geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
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
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "invalid", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geometry must be an object" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "geo query doesn't have any geometry" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },

    // Test with $box
    { value: { $box: [[0, 0], [1, 1]] }, message: 'should validate with $box', exceptions: {} },
    { value: { $box: [[0, 0]] }, message: 'should invalidate with $box (invalid coordinates)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $box: [0, 0] }, message: 'should invalidate with $box (invalid format)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type int" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },

    // Test with $polygon
    { value: { $polygon: [[0, 0], [1, 1], [1, 0], [0, 0]] }, message: 'should validate with $polygon', exceptions: {} },
    { value: { $polygon: [[0, 0], [1, 1], [1, 0]] }, message: 'should validate with $polygon (not closed)', exceptions: {} },
    { value: { $polygon: [] }, message: 'should invalidate with $polygon (empty)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Polygon must have at least 3 points, " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },

    // Test with $center
    { value: { $center: [[0, 0], 10] }, message: 'should validate with $center', exceptions: {} },
    { value: { $center: [[0, 0]] }, message: 'should invalidate with $center (missing radius)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Radius must be a non-negative number: EOO" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $center: [0, 0] }, message: 'should invalidate with $center (invalid format)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type int" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },

    // Test with $centerSphere
    { value: { $centerSphere: [[0, 0], 10] }, message: 'should validate with $centerSphere', exceptions: {} },
    { value: { $centerSphere: [[0, 0]] }, message: 'should invalidate with $centerSphere (missing radius)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Radius must be a non-negative number: EOO" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $centerSphere: [0, 0] }, message: 'should invalidate with $centerSphere (invalid format)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type int" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },

    // Multiple shapes
    { value: { $centerSphere: [[0, 0], 10], $center: [[0, 0], 10] }, message: 'should invalidate with multiple shapes ($centerSphere & $center)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geoWithin doesn't accept multiple shapes $geoWithin" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $centerSphere: [[0, 0], 10], $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] } }, message: 'should invalidate with multiple shapes ($centerSphere & $geometry)', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geoWithin doesn't accept multiple shapes $geoWithin" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];

const dbTestTable: DbTest[] = [
    { filter: { point: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoWithin polygon' },
    { filter: { point: { $geoWithin: { $geometry: { type: "Polygon", coordinates: [[[20, 20], [22, 22], [22, 21], [20, 20]]] } } } }, success: false, message: 'should not validate with $geoWithin polygon (no intersection)' },
    { filter: { multiPoint: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoWithin multi-point' },
    { filter: { lineString: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: false, message: 'should invalidate with $geoWithin line string' },
    { filter: { multiLineString: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: false, message: 'should invalidate with $geoWithin multi-line string' },
    { filter: { polygon: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoWithin polygon' },
    { filter: { multiPolygon: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: false, message: 'should invalidate with $geoWithin multi-polygon' },
    { filter: { geometryCollection: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoWithin geometry collection' },
    { filter: { coordinates: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: true, message: 'should validate with $geoWithin coordinates' },
    { filter: { extra: { $geoWithin: { $geometry: exampleObject1.polygon } } }, success: false, message: 'should invalidate on random property' },

    // Test with $box
    { filter: { point: { $geoWithin: { $box: [[0, 0], [1, 1]] } } }, success: true, message: 'should validate with $geoWithin $box' },
    { filter: { point: { $geoWithin: { $box: [[20, 20], [21, 21]] } } }, success: false, message: 'should not validate with $geoWithin $box (no intersection)' },

    // Test with $polygon
    { filter: { point: { $geoWithin: { $polygon: [[0, 0], [1, 1], [1, 0], [0, 0]] } } }, success: true, message: 'should validate with $geoWithin $polygon' },
    { filter: { point: { $geoWithin: { $polygon: [[20, 20], [21, 21], [21, 20], [20, 20]] } } }, success: false, message: 'should not validate with $geoWithin $polygon (no intersection)' },

    // Test with $center
    { filter: { point: { $geoWithin: { $center: [[0, 0], 10] } } }, success: true, message: 'should validate with $geoWithin $center' },
    { filter: { point: { $geoWithin: { $center: [[20, 20], 1] } } }, success: false, message: 'should not validate with $geoWithin $center (no intersection)' },

    // Test with $centerSphere
    { filter: { point: { $geoWithin: { $centerSphere: [[0, 0], 10] } } }, success: true, message: 'should validate with $geoWithin $centerSphere' },
    { filter: { point: { $geoWithin: { $centerSphere: [[20, 20], 0.0001] } } }, success: false, message: 'should not validate with $geoWithin $centerSphere (no intersection)' },

    // Test on legacy coordinates
    { filter: { coordinates: { $geoWithin: { $box: [[0, 0], [1, 1]] } } }, success: true, message: 'should validate with $geoWithin on legacy coordinates' },
    { filter: { coordinates: { $geoWithin: { $box: [[20, 20], [21, 21]] } } }, success: false, message: 'should not validate with $geoWithin on legacy coordinates (no intersection)' },
];

describe('filter operators - $geoWithin', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const operator = { $geoWithin: value };

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
