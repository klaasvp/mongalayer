import { z } from 'zod';
import { filterOperatorsSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer, MongalayerCollection, MongalayerCollections } from '@mongalayer/server';
import { FilterTests, filterTestsSchema } from '../../../../data/filterTests';
import { isMongoServerError } from './helper';

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

describe('filter operators - $exists', () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        const filterTestsCollection: MongalayerCollection<FilterTests> = {
            schema: filterTestsSchema,
            access: []
        };

        const collections: MongalayerCollections = {
            filterTests: filterTestsCollection
        }

        mongalayer = new Mongalayer(globalThis.$mdb.client, collections, {
            //debugging: true,
            useSessions: true
        });
    });

    test.each(valuesTable)('$message', async ({ value, success }) => {
        const operator = { $exists: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', z.ZodIssueCode.invalid_type);
            }

            const mongaResult = await mongalayer.execute<FilterTests>({
                database: globalThis.$mdb.db,
                collection: "filterTests",
                operation: "findOne",
                payload: {
                    filter: {
                        property: operator
                    }
                }
            }, {});

            // Apparently the server does not return an error for weird values, but just an empty result
            expect(mongaResult).toBeNull();
    });
});
