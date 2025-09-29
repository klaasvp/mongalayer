import { filterSchema } from '#src/schema/query';
import { Mongalayer } from '#src/core';
import { isMongoInvalidArgumentError, isMongoServerError, ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

describe('filter - basis', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable: ValueTest[] = [
        { filter: 42, success: false, message: `should not validate with number`, exceptions: {
            mongoapi: { message: "Query filter must be a plain object or ObjectId" },
            zod: { code: "invalid_type", message: 'Invalid input: expected object, received number' }
        } },
        { filter: "a", success: false, message: `should not validate with string`, exceptions: {
            mongoapi: { message: "Query filter must be a plain object or ObjectId" },
            zod: { code: "invalid_type", message: 'Invalid input: expected object, received string' }
        } },
        { filter: true, success: false, message: `should not validate with boolean`, exceptions: {
            mongoapi: { message: "Query filter must be a plain object or ObjectId" },
            zod: { code: "invalid_type", message: 'Invalid input: expected object, received boolean' }
        } },
        { filter: null, success: false, message: `should not validate with null`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "Expected field filterto be of type object" },
            zod: { code: "invalid_type", message: 'Invalid input: expected object, received null' }
        } },
        { filter: [], success: false, message: `should not validate with array`, exceptions: {
            mongoapi: { message: "Query filter must be a plain object or ObjectId" },
            zod: { code: "invalid_type", message: 'Invalid input: expected object, received array' }
        } },
        { filter: { key: "value" }, success: true, message: `should validate with object`},
        { filter: { $unknown: "value" }, success: false, message: `should invalidate with object & unknown operator`, exceptions: {
            mongodb: { code: 2, codeName: "BadValue", message: "unknown top level operator: $unknown. If you have a field name that starts with a '$' symbol, consider using $getField or $setField." },
            zod: { code: "custom", message: 'Invalid filter root operator' }
        } },
        { filter: { child: { key: "value" } }, success: true, message: `should validate with nested object`},
        { filter: { child: { $unknown: "value" } }, success: false, message: `should invalidate with nested object & unknown operator`, exceptions: {
            mongodb: { code: 2, codeName: "BadValue", message: "unknown operator: $unknown" },
            zod: { code: "custom", message: 'Invalid filter operator' }
        } },
        { filter: {}, success: true, message: `should validate with empty object`}
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ filter, success, exceptions }) => {
            const zodResult = filterSchema.safeParse(filter);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0].code).toBe(exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne(filter, {});

                // Apparently the server does not return an error for weird values, but just an empty result
                expect(result).toBeNull();
            } catch (e) {
                if (!success && isMongoServerError(e)) {
                    expect(e.code).toBe(exceptions?.mongodb?.code);
                    expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
                    expect(e.message).toBe(exceptions?.mongodb?.message);
                } else if (!success && isMongoInvalidArgumentError(e)) {
                    expect(e.message).toBe(exceptions?.mongoapi?.message);
                } else {
                    throw e;
                }
            }
        });
    });
});
