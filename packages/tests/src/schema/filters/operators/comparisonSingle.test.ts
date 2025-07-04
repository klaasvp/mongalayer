import { z } from 'zod';
import { filterOperatorsSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer, MongalayerCollection, MongalayerCollections } from '@mongalayer/server';
import { FilterTests, filterTestsSchema } from '../../../../data/filterTests';
import { isMongoServerError } from './helper';

const operatorsTable = [
    ["$eq"],
    ["$gt"],
    ["$gte"],
    ["$lt"],
    ["$lte"],
    ["$ne"]
];

const valuesTable = [
    { value: 42, success: true, message: `should validate with number`},
    { value: "a", success: true, message: `should validate with string`},
    { value: true, success: true, message: `should validate with boolean`},
    { value: null, success: true, message: `should validate with null`},
    { value: [1, 2, 3], success: true, message: `should validate with array`},
    { value: { key: 'value' }, success: true, message: `should validate with object`},
    { value: [{ key: 'value' }], success: true, message: `should validate with objects array`},
    { value: { key: 'value', list: [1, 2, 3], nested: { key: 'value' }, bool: true, null: null, number: 1, string: "test" }, success: true, message: `should validate with mixed object`},
    { value: [1, "a", true, null, [1, 2, 3], { key: 'value' }], success: true, message: `should validate with mixed array`},
];

describe('filter operators - Comparison single', () => {
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

    describe.each(operatorsTable)('%s', ($operator) => {
        test.each(valuesTable)('$message', async ({value, success, message}) => {
            const operator = { [$operator]: value };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) { 
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', z.ZodIssueCode.invalid_type);
            }

            try { 
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

                if (success) {
                    expect(mongaResult).toBeNull();
                } else {
                    throw "mongalayer.execute should have thrown an error";
                }
            } catch (e) {
                if (!success && isMongoServerError(e)) {
                    expect(e.code).toBe(2);
                    expect(e.codeName).toBe('BadValue');
                    expect(e.message).toBe(`${$operator} XXX`);
                } else {
                    throw e;
                }
            }
        });
    });
});
