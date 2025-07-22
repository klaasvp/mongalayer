import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';

const valuesTable: ValueTest[] = [
    { filter: { $rand: {} }, message: 'should invalidate in root', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown top level operator: $rand" },
        zod: { code: "custom", message: 'Invalid filter root operator' }
    } },
    { filter: { field: { $rand: {} } }, message: 'should invalidate as operator', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown operator: $rand" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];

describe('filter operators - $rand', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ filter, success, message, exceptions }) => {
            const zodResult = filterSchema.safeParse(filter);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne(filter, {});

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
});
