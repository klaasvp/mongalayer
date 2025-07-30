import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { getValuesTable } from './near.js';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { MongalayerCollectionType } from '#src/index.js';

const valuesTable: ValueTest[] = getValuesTable('$near');

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
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
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
