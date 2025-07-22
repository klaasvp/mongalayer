import { filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

describe('filter operators - $jsonSchema', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable: ValueTest[] = [
        { value: 42, success: false, message: `should not validate with number`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "$jsonSchema must be an object" }
        } },
        { value: "a", success: false, message: `should not validate with string`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "$jsonSchema must be an object" }
        } },
        { value: true, success: false, message: `should not validate with boolean`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "$jsonSchema must be an object" }
        } },
        { value: null, success: false, message: `should not validate with null`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "$jsonSchema must be an object" }
        } },
        { value: [], success: false, message: `should not validate with array`, exceptions: {
            mongodb: { code: 14, codeName: "TypeMismatch", message: "$jsonSchema must be an object" }
        } },
        { value: {}, success: false, message: `should not validate with object`}
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, exceptions }) => {
            const operator = { $jsonSchema: value };

            const zodResult = filterSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', "invalid_type");
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne(operator, {});

                expect(result).toBeNull();
            } catch (e) {
                if (!success && isMongoServerError(e)) {
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
