import { filterOperatorsSchema } from '../../../../../server/src/actions/schema';
import { isMongoServerError, ValueTest } from '../helper';
import { SchemaTest } from '../../../../data/schemaTest';
import { describe, expect, test } from '@jest/globals';

const valuesTable: ValueTest[] = [
    { filter: { $options: 'i' }, success: true, message: 'should invalidate without $regex', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options needs a $regex" }
    } },
    { filter: { $options: 'i', $regex: "^[a-z]+$" }, success: true, message: 'should validate with valid options "i"' },
    { filter: { $options: 'uxsmi', $regex: "^[a-z]+$" }, success: true, message: 'should validate with valid options "uxsmi"' },
    { filter: { $options: 'a', $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with invalid options "a"', exceptions: {
        mongodb: { code: 51108, codeName: "Location51108", message: " invalid flag in regex options: a" },
        zod: { code: "invalid_format", message: 'Invalid string: must match pattern' }
    }  },
    { filter: { $options: '', $regex: "^[a-z]+$" }, success: true, message: 'should validate with empty options', exceptions: {
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received object' }
    } },
    { filter: { $options: 123, $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options has to be a string" },
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received number' }
    } },
    { filter: { $options: true, $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options has to be a string" },
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received boolean' }
    } },
    { filter: { $options: null, $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options has to be a string" },
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received null' }
    } },
    { filter: { $options: [], $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with array', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options has to be a string" },
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received array' }
    } },
    { filter: { $options: {}, $regex: "^[a-z]+$" }, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "$options has to be a string" },
        zod: { code: "invalid_type", message: 'Invalid input: expected string, received object' }
    } }
];

describe('filter operators - $options', () => {
    let database = globalThis.$mdb.db;

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ filter, success, message, exceptions }) => {
            const operator = filter;

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) {
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne({
                    property: operator
                }, {});

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

    // On collection tests are included in ./regex.test.ts
    // describe('on filterTestSolo collection', () => { });
});
