import { z } from 'zod';
import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer, MongalayerCollectionType } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { Db } from 'mongodb';
import { beforeAll, describe, expect, test } from 'vitest';
import { SchemaTest } from '#test/data/schemaTest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

type Operator = "$eq" | "$gt" | "$gte" | "$lt" | "$lte" | "$ne";

const operatorsTable: [Operator][] = [
    ["$eq"],
    ["$gt"],
    ["$gte"],
    ["$lt"],
    ["$lte"],
    ["$ne"]
];

const valuesTable: ValueTest[] = [
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

const dbTestTables: Record<Operator, DbTest[]> = {
    $eq: [
        { filter: { name: { $eq: exampleObject1.name } }, success: true, message: `"name === name" should return _id a`},
        { filter: { name: { $eq: "" } }, success: false, message: `"name !== ''" should not return anything`}
    ],
    $gt: [
        { filter: { "details.nestedObject.property2": { $gt: exampleObject1.details.nestedObject.property2 - 1 } }, success: true, message: `"prop > prop - 1" should return _id a`},
        { filter: { "details.nestedObject.property2": { $gt: exampleObject1.details.nestedObject.property2 } }, success: false, message: `"prop > prop" should not return anything`}
    ],
    $gte: [
        { filter: { "details.nestedObject.property2": { $gte: exampleObject1.details.nestedObject.property2 - 1 } }, success: true, message: `"prop >= prop - 1" should return _id a`},
        { filter: { "details.nestedObject.property2": { $gte: exampleObject1.details.nestedObject.property2 } }, success: true, message: `"prop >= prop" should return _id a`},
        { filter: { "details.nestedObject.property2": { $gte: exampleObject1.details.nestedObject.property2 + 1 } }, success: false, message: `"prop >= prop + 1" should not return anything`}
    ],
    $lt: [
        { filter: { "details.nestedObject.property2": { $lt: exampleObject1.details.nestedObject.property2 + 1 } }, success: true, message: `"prop < prop + 1" should return _id a`},
        { filter: { "details.nestedObject.property2": { $lt: exampleObject1.details.nestedObject.property2 } }, success: false, message: `"prop < prop" should not return anything`}
    ],
    $lte: [
        { filter: { "details.nestedObject.property2": { $lte: exampleObject1.details.nestedObject.property2 + 1 } }, success: true, message: `"prop <= prop - 1" should return _id a`},
        { filter: { "details.nestedObject.property2": { $lte: exampleObject1.details.nestedObject.property2 } }, success: true, message: `"prop <= prop" should return _id a`},
        { filter: { "details.nestedObject.property2": { $lte: exampleObject1.details.nestedObject.property2 - 1 } }, success: false, message: `"prop <= prop + 1" should not return anything`}
    ],
    $ne: [
        { filter: { name: { $ne: exampleObject1.name } }, success: false, message: `"name === name" should not return anything`},
        { filter: { name: { $ne: "" } }, success: true, message: `"name !== ''" should return _id a`}
    ]
};

describe('filter operators - Comparison single', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
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
                    const result = await database.collection<SchemaTest>("schemaTest").findOne({
                        property: operator
                    }, {});

                    if (success) {
                        expect(result).toBeNull();
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
        
        describe('on filterTestSolo collection', () => {
            test.each(dbTestTables[$operator])('$message', async ({ filter, success }) => {
                const zodResult = filterSchema.safeParse(filter);
    
                // Database tests should always be a valid schema
                expect(zodResult.success).toBe(true);
    
                const mongaResult = await mongalayer.execute({
                    database: dbName,
                    collection: "filterTestSolo" as MongalayerCollectionType<FilterTest>,
                    operation: "findOne"
                }, { filter }, {});
    
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
