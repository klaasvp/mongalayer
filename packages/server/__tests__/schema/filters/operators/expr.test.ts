import { filterSchema } from '#src/schema/query';
import { Mongalayer } from '#src/core';
import { ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

describe('filter operators - $expr', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable: ValueTest[] = [
        { value: 42, success: false, message: `should not validate with number`},
        { value: "a", success: false, message: `should not validate with string`},
        { value: true, success: false, message: `should not validate with boolean`},
        { value: null, success: false, message: `should not validate with null`},
        { value: [], success: false, message: `should not validate with array`},
        { value: {}, success: false, message: `should not validate with object`}
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success }) => {
            const operator = { $expr: value };

            const zodResult = filterSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', "invalid_type");
            }

            const result = await database.collection<SchemaTest>("schemaTest").findOne(operator, {});

            // Apparently the server does not return an error for weird values, but just an empty result
            expect(result).toBeNull();
        });
    });
});
