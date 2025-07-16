import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { exampleObject1, exampleObject2, FilterTest } from '../../../../data/filterTest';
import { DbTest, getMongaLayerForFilterTest, isMongoServerError, ValueTest } from '../helper';
import { SchemaTest } from '../../../../data/schemaTest';
import { beforeAll, describe, expect, test } from '@jest/globals';

const valuesTable: ValueTest[] = [
    // Test with positionSchema
    { filter: { $near: [0, 0] }, message: 'should validate with valid position', exceptions: {} },
    { filter: { $near: [0, 0], $minDistance: 0.1 }, message: 'should invalidate with valid position and $minDistance', exceptions: {
        zod: { code: "custom", message: 'Invalid filter operator' }
    } },
    { filter: { $near: [0, 0], $maxDistance: 0.1 }, message: 'should validate with valid position and $maxDistance', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] } }, message: 'should validate with valid geometry', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 1 }, message: 'should validate with valid geometry and minDistance', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: 10 }, message: 'should validate with valid geometry and maxDistance', exceptions: {} },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 1, $maxDistance: 10 }, message: 'should validate with valid geometry, minDistance, and maxDistance', exceptions: {} },
    // Note, we'd expect this to be invalid, but MongoDB doesn't check for this
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: 10, $maxDistance: 1 }, message: 'should invalidate with minDistance > maxDistance', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be less than or equal to $maxDistance" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }, message: 'should invalidate with LineString', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Expected geojson geometry with type Point, but got type LineString" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] } }, message: 'should invalidate with Polygon', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Expected geojson geometry with type Point, but got type Polygon" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "near must be first in: { $near: 123 }" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "invalid", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "near must be first in: { $near: \"invalid\" }" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "near must be first in: { $near: true }" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "near must be first in: { $near: null }" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geometry is required for geo near query" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$geometry is required for geo near query" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: {} }, message: 'should invalidate with empty geometry object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point" } }, message: 'should invalidate with missing coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must be an array or object, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [] } }, message: 'should invalidate with empty coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0] } }, message: 'should invalidate with single coordinate', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    // Note, we'd expect this to be invalid, but MongoDB doesn't check for this
    { value: { $geometry: { type: "Point", coordinates: [0, 0, 0] } }, message: 'should invalidate with too many coordinates', exceptions: {
        //mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type missing" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: ["0", "0"] } }, message: 'should invalidate with non-numeric coordinates', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Point must only contain numeric elements, instead got type string" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: "1" }, message: 'should invalidate with non-numeric minDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be a number" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: "10" }, message: 'should invalidate with non-numeric maxDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$maxDistance must be a number" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $minDistance: -1 }, message: 'should invalidate with negative minDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$minDistance must be non-negative" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $geometry: { type: "Point", coordinates: [0, 0] }, $maxDistance: -1 }, message: 'should invalidate with negative maxDistance', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$maxDistance must be non-negative" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];

const dbTestTable: DbTest[] = [
    { filter: { point: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should validate with $near point' },
    { filter: { point: { $near: { $geometry: { type: "Point", coordinates: [20, 20] }, $maxDistance: 1 } } }, success: false, message: 'should not validate with $near point (no intersection)' },
    { filter: { multiPoint: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near multi-point' },
    { filter: { lineString: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near line string' },
    { filter: { multiLineString: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near multi-line string' },
    { filter: { polygon: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near polygon' },
    { filter: { multiPolygon: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near multi-polygon' },
    { filter: { geometryCollection: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should invalidate with $near geometry collection' },
    { filter: { coordinates: { $near: { $geometry: exampleObject1.point } } }, success: true, message: 'should validate on $near coordinates' },
    { filter: { coordinates: { $near: [0, 0] } }, success: true, message: 'should validate with $near coordinates' },
    { filter: { coordinates: { $near: [0, 0], $maxDistance: 10 } }, success: true, message: 'should validate with $near coordinates and < maxDistance' },
    { filter: { coordinates: { $near: [5, 5], $maxDistance: 1 } }, success: false, message: 'should invalidate with $near coordinates and > maxDistance' },
    { filter: { point: { $near: { $geometry: exampleObject1.point, $minDistance: 10 } } }, success: false, message: 'should invalidate with $near point with > minDistance' },
    { filter: { point: { $near: { $geometry: exampleObject1.point, $maxDistance: 10 } } }, success: true, message: 'should validate with $near point with < maxDistance' },
];

describe('filter operators - $near', () => {
    let mongalayer: Mongalayer, database = globalThis.$mdb.db;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, filter, success, message, exceptions }) => {
            const operator = filter ?? { $near: value };

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
                database: globalThis.$mdb.name,
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
