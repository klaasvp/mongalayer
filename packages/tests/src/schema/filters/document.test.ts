import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { getMongaLayerForFilterTest, isMongoServerError, isZodError, MongoDBException, ZodException } from './helper';
import { SchemaTest } from '../../../data/schemaTest';
import { Document, Filter } from 'mongodb';

describe('filter - basis', () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest({ debugging: true });
    });

    const valuesTable: { filter: any, success: boolean, message: string, exceptions?: { zod?: ZodException, mongodb?: MongoDBException } }[] = [
        { filter: 42, success: false, message: `should not validate with number`, exceptions: {
            zod: { code: "invalid_type", message: 'Invalid input: expected record, received number' }
        }  },
        { filter: "a", success: false, message: `should not validate with string`, exceptions: {
            zod: { code: "invalid_type", message: 'Invalid input: expected record, received string' }
        }  },
        { filter: true, success: false, message: `should not validate with boolean`, exceptions: {
            zod: { code: "invalid_type", message: 'Invalid input: expected record, received boolean' }
        }  },
        { filter: null, success: false, message: `should not validate with null`, exceptions: {
            zod: { code: "invalid_type", message: 'Invalid input: expected record, received null' }
        }  },
        { filter: [], success: false, message: `should not validate with array`, exceptions: {
            zod: { code: "invalid_type", message: 'Invalid input: expected record, received array' }
        }  },
        { filter: { key: "value" }, success: true, message: `should validate with object`},
        { filter: { child: { key: "value" } }, success: true, message: `should validate with nested object`},
        { filter: {}, success: true, message: `should validate with empty object`}
    ];

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ filter, success, exceptions }) => {
            const zodResult = filterSchema.safeParse(filter);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', "invalid_type");
            }

            try {
                const mongaResult = await mongalayer.execute<SchemaTest>({
                    database: globalThis.$mdb.db,
                    collection: "schemaTest",
                    operation: "findOne",
                    payload: {
                        filter
                    }
                }, {});

                // Apparently the server does not return an error for weird values, but just an empty result
                expect(mongaResult).toBeNull();
            } catch (e) {
                if (!success && isMongoServerError(e)) {
                    expect(e.code).toBe(2);
                    expect(e.codeName).toBe('BadValue');
                    expect(e.message).toBe(`x needs an array`);
                } else if (!success && isZodError(e)) {
                    expect(e.issues[0].code).toBe(exceptions?.zod?.code);
                    expect(e.issues[0].message).toBe(exceptions?.zod?.message);
                } else {
                    throw e;
                }
            }
        });
    });
});
