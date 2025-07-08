import { z } from 'zod';
import { filterOperatorsSchema, filterSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { FilterTest} from '../../../../data/filterTest';
import { getMongaLayerForFilterTest } from '../helper';
import { beforeAll, describe, expect, test } from '@jest/globals';
import { SchemaTest } from '../../../../data/schemaTest';

describe('filter operators - $exists', () => {
    let mongalayer: Mongalayer, database = globalThis.$mdb.db;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable = [
        { value: 42, success: false, message: `should not validate with number`},
        { value: "a", success: false, message: `should not validate with string`},
        { value: true, success: true, message: `should validate with true`},
        { value: false, success: true, message: `should validate with false`},
        { value: "false", success: false, message: `should not validate with "false"`},
        { value: "true", success: false, message: `should not validate with "true"`},
        { value: 0, success: false, message: `should not validate with 0`},
        { value: null, success: false, message: `should not validate with null`},
        { value: [1, 2, 3], success: false, message: `should not validate with array`},
        { value: { key: 'value' }, success: false, message: `should not validate with object`},
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success }) => {
            const operator = { $exists: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', z.ZodIssueCode.invalid_type);
            }

            const result = await database.collection<SchemaTest>("schemaTest").findOne({
                property: operator
            }, {});

            // Apparently the server does not return an error for weird values, but just an empty result
            expect(result).toBeNull();
        });
    });

    const dbTestTable = [
        { filter: { name: { $exists: true } }, success: true, message: `"name: true" should return _id a`},
        { filter: { property: { $exists: true } }, success: false, message: `"property: true" should not return anything`},
        { filter: { property: { $exists: false } }, success: true, message: `"property: false" should return _id a`},
    ];

    describe('on filterTestSolo collection', () => {
        test.each(dbTestTable)('$message', async ({ filter, success }) => {
            const zodResult = filterSchema.safeParse(filter);

            // Database tests should always be a valid schema
            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.execute<FilterTest>({
                database: globalThis.$mdb.name,
                collection: "filterTest",
                operation: "findOne",
                payload: {
                    filter
                }
            }, {});

            if (success) {
                expect(mongaResult).toBeDefined();
                expect(mongaResult).toHaveProperty('_id', 'a');
            } else {
                expect(mongaResult).toBeNull();
            }
        });
    });
});