import { z } from 'zod';
import { filterOperatorsSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer, MongalayerCollection, MongalayerCollections } from '@mongalayer/server';
import { FilterTest, filterTestsSchema } from '../../../../data/filterTests';
import { isMongoServerError } from './helper';
import { success } from 'zod/v4';

const operatorsTable = [
    ["$in"],
    ["$nin"]
];

const valuesTable = [
    { value: [1, 2, 3], success: true, message: `should validate with numbers array`},
    { value: ["a", "b", "c"], success: true, message: `should validate with strings array`},
    { value: [true, false], success: true, message: `should validate with booleans array`},
    { value: [[1, 2, 3], [1, 2, 3]], success: true, message: `should validate with 2d array`},
    { value: [{ key: 'value' }, { value: 'key' }], success: true, message: `should validate with objects array`},
    { value: [1, "a", true, null, [1, 2, 3], { key: 'value' }], success: true, message: `should validate with mixed array`},
    { value: null, success: false, message: `should invalidate with null`},
    { value: "string", success: false, message: `should invalidate with string`},
    { value: 123, success: false, message: `should invalidate with number`},
    { value: true, success: false, message: `should invalidate with boolean`},
    { value: { key: 'value' }, success: false, message: `should invalidate with object`},
];

describe("filter operators - Comparison multiple", () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        const filterTestsCollection: MongalayerCollection<FilterTest> = {
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
                const mongaResult = await mongalayer.execute<FilterTest>({
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
                    expect(e.message).toBe(`${$operator} needs an array`);
                } else {
                    throw e;
                }
            }
        });
    });
});