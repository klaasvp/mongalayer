import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '../../../../../server/src/actions/schema';
import { Mongalayer } from '@mongalayer/server';
import { exampleObject1, FilterTest } from '../../../../data/filterTest';
import { getMongaLayerForFilterTest, isMongoServerError } from './helper';
import { Filter } from 'mongodb';

type Operator = "$in" | "$nin";

const operatorsTable: [Operator][] = [
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

const dbTestTables: Record<Operator, { filter: Filter<FilterTest>, success: boolean, message: string }[]> = {
    $in: [
        // Match scaler
        { filter: { _id: { $in: [exampleObject1._id, ""] } }, success: true, message: `"_id in list" should return _id a`},
        { filter: { _id: { $in: ["", ""] } }, success: false, message: `"_id not in list" should not return anything`},
        // Match array
        { filter: { "details.metadata.tags": { $in: [exampleObject1.details.metadata.tags[1], ""] } }, success: true, message: `"_id in list" should return _id a`},
        { filter: { "details.metadata.tags": { $in: ["", ""] } }, success: false, message: `"_id not in list" should not return anything`}
    ],
    $nin: [
        // Match scaler
        { filter: { _id: { $nin: [exampleObject1._id, ""] } }, success: false, message: `"_id in list" should not return anything`},
        { filter: { _id: { $nin: ["", ""] } }, success: true, message: `"_id not in list" should return _id a`},
        // Match array
        { filter: { "details.metadata.tags": { $nin: [exampleObject1.details.metadata.tags[1], ""] } }, success: false, message: `"_id in list" should not return anything`},
        { filter: { "details.metadata.tags": { $nin: ["", ""] } }, success: true, message: `"_id not in list" should return _id a`}
    ],
};

describe("filter operators - Comparison multiple", () => {
    let mongalayer: Mongalayer;

    beforeAll(async () => {
        mongalayer = getMongaLayerForFilterTest();
    });

    describe.each(operatorsTable)('%s', ($operator) => {
        describe('validation', () => {
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
                        expect(e.code).toBe(2);
                        expect(e.codeName).toBe('BadValue');
                        expect(e.message).toBe(`${$operator} needs an array`);
                    } else {
                        throw e;
                    }
                }
            });
        });
                
        describe('on filterTestSolo collection', () => {
            test.each(dbTestTables[$operator])('$message', async ({ filter, success }) => {
                const zodResult = filterSchema.safeParse(filter);
    
                // Database tests should always be a valid schema
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
                    expect(mongaResult).toHaveProperty('_id', 'a');
                } else {
                    expect(mongaResult).toBeNull();
                }
            });
        });
    });
});