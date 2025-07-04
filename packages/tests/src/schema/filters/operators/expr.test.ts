import { z } from 'zod/v4';
import { filterOperatorsSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { getMongaLayerForFilterTest } from './helper';
import { SchemaTest } from '../../../../data/schemaTest';

describe('filter operators - $expr', () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest();
    });

    const valuesTable = [
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

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', "invalid_type");
            }

            const mongaResult = await mongalayer.execute<SchemaTest>({
                database: globalThis.$mdb.db,
                collection: "schemaTest",
                operation: "findOne",
                payload: {
                    filter: operator
                }
            }, {});

            // Apparently the server does not return an error for weird values, but just an empty result
            expect(mongaResult).toBeNull();
        });
    });
});
