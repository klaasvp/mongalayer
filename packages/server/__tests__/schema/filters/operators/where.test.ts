import { filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

describe('filter operators - $where', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable: ValueTest[] = [
        { value: 42, success: false, message: `should not validate with number`, exceptions: { mongodb: { code: 2, codeName: "BadValue", message: "$where got bad type" } } },
        { value: "a", success: false, message: `should not validate with string`},
        { value: true, success: false, message: `should not validate with boolean`, exceptions: { mongodb: { code: 2, codeName: "BadValue", message: "$where got bad type" } } },
        { value: null, success: false, message: `should not validate with null`, exceptions: { mongodb: { code: 2, codeName: "BadValue", message: "$where got bad type" } } },
        { value: [], success: false, message: `should not validate with array`, exceptions: { mongodb: { code: 2, codeName: "BadValue", message: "$where got bad type" } } },
        { value: {}, success: false, message: `should not validate with object`, exceptions: { mongodb: { code: 2, codeName: "BadValue", message: "$where got bad type" } } },
        { value: function () {}, success: false, message: `should not validate with function`},
        { value: () => {}, success: false, message: `should not validate with arrow function`}
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, exceptions }) => {
            const operator = { $where: value };

            const zodResult = filterSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', "invalid_type");
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne(operator, {});

                // Apparently the server does not return an error for weird values, but just an empty result
                expect(result).toBeNull();
            } catch (e) {
                if (exceptions?.mongodb && isMongoServerError(e)) {
                    expect(e.code).toBe(exceptions?.mongodb?.code);
                    expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
                    expect(e.message).toBe(exceptions?.mongodb?.message);
                } else {
                    throw e;
                }
            }
        });
    });
});
