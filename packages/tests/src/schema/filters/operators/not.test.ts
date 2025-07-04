import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { exampleObject1, exampleObject2, FilterTest } from '../../../../data/filterTest';
import { getMongaLayerForFilterTest, isMongoServerError } from '../helper';
import { SchemaTest } from '../../../../data/schemaTest';

describe('filter operators - $not', () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest();
    });

    const valuesTable = [
        { value: { $eq: 42 }, success: true, message: 'should validate with $eq' },
        { value: { $in: [10] }, success: true, message: 'should validate with $in' },
        { value: { $invalid: 42 }, success: false, message: 'should invalidate with invalid operator', zodError: "unrecognized_keys", exceptions: {
            mongodb: { code: 2, codeName: "BadValue", message: "unknown operator: " }
        }  },
        { value: null, success: false, message: 'should invalidate with null', zodError: "invalid_type", exceptions: {
            mongodb: { code: 2, codeName: "BadValue", message: "$not argument must be a regex or an object" }
        }  },
        { value: { $not: 42 }, success: false, message: 'should invalidate with nested $not', zodError: "unrecognized_keys", exceptions: {
            mongodb: { code: 2, codeName: "BadValue", message: "$not argument must be a regex or an object" }
        } },
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, zodError, exceptions }) => {
            const operator = { $not: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) {
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', zodError);
            }

            try { 
                const mongaResult = await mongalayer.execute<SchemaTest>({
                    database: globalThis.$mdb.db,
                    collection: "schemaTest",
                    operation: "findOne",
                    payload: {
                        filter: {
                            property: operator
                        }
                    }
                }, {});

                if (success) {
                    expect(mongaResult).toBeNull();
                } else {
                    throw "mongalayer.execute should have thrown an error";
                }
            } catch (e) {
                if (!success && isMongoServerError(e)) {
                    if (exceptions) {
                        expect(e.code).toBe(exceptions.mongodb.code);
                        expect(e.codeName).toBe(exceptions.mongodb.codeName);
                        expect(e.message.startsWith(exceptions.mongodb.message)).toBe(true);
                    } else {    
                        expect(e.code).toBe(2);
                        expect(e.codeName).toBe('BadValue');
                        expect(e.message).toBe("");
                    }
                } else {
                    throw e;
                }
            }
        });
    });

    const dbTestTable = [
        { filter: { name: { $not: { $eq: exampleObject2.name } } }, success: true, message: 'should validate with $not $eq' },
        { filter: { name: { $not: { $eq: exampleObject1.name } } }, success: false, message: 'should not validate with $not $eq' }
    ];

    describe('on filterTestSolo collection', () => {
        test.each(dbTestTable)('$message', async ({ filter, success, message }) => {
            const zodResult = filterSchema.safeParse(filter);

            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.execute<FilterTest>({
                database: globalThis.$mdb.db,
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
