import { filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, isZodError, MongoDBException, ValueTest, ZodException } from '../helper.js';
import { Db, Filter } from 'mongodb';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

type Operator = "$and" | "$or" | "$nor";

const operatorsTable: [Operator][] = [
    ["$and"],
    ["$or"],
    ["$nor"]
];

const valuesTable: ValueTest[] = [
    { value: [{ name: 'John' }, { age: 30 }], success: true, message: `should validate with array of objects`},
    { value: [{ valid: true }], success: true, message: `should validate with array of a object`},
    { value: [], success: false, message: `should invalidate with empty array`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be a non-empty array" },
        zod: { code: "too_small", message: 'Too small: expected array to have >=1 items' }
    }},
    { value: [{ $and: [{ name: 'John' }, { age: 30 }] }], success: true, message: `should validate with nested $and array of objects`},
    { value: [{ $or: [{ name: 'John' }, { age: 30 }] }], success: true, message: `should validate with nested $or array of objects`},
    { value: [{ $nor: [{ name: 'John' }, { age: 30 }] }], success: true, message: `should validate with nested $nor array of objects`},
    { value: [{ valid: { $and: [{ name: 'John' }, { age: 30 }] } }], success: false, message: `should invalidate with $and as operator`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "unknown operator: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    }},
    { value: 'invalid', success: false, message: `should invalidate with string`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received string' }
    }},
    { value: null, success: false, message: `should invalidate with null`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received null' }
    }},
    { value: 123, success: false, message: `should invalidate with number`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received number' }
    }},
    { value: true, success: false,  message: `should invalidate with boolean`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received boolean' }
    }},
    { value: {}, success: false, message: `should invalidate with object`, exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "argument must be an array" },
        zod: { code: "invalid_type", message: 'Invalid input: expected array, received object' }
    }}
];

const dbTestTables: Record<Operator, DbTest[]> = {
    $and: [
        { filter: { $and: [{ name: exampleObject1.name }, { status: exampleObject1.status }] }, success: true, message: `"$and with valid conditions" should return _id a`},
        { filter: { $and: [{ name: "" }, { status: exampleObject1.status }] }, success: false, message: `"$and with invalid conditions" should not return anything`}
    ],
    $or: [
        { filter: { $or: [{ name: exampleObject1.name }, { status: exampleObject1.status }] }, success: true, message: `"$or with 2 valid conditions" should return _id a`},
        { filter: { $or: [{ name: exampleObject1.name }, { status: !exampleObject1.status }] }, success: true, message: `"$or with 1 valid conditions" should return _id a`},
        { filter: { $or: [{ name: "" }, { status: !exampleObject1.status }] }, success: false, message: `"$or with invalid conditions" should not return anything`}
    ],
    $nor: [
        { filter: { $nor: [{ name: exampleObject1.name }, { status: exampleObject1.status }] }, success: false, message: `"$nor with 2 valid conditions" should not return anything`},
        { filter: { $nor: [{ name: "" }, { status: exampleObject1.status }] }, success: false, message: `"$nor with 1 valid condition" should not return anything`},
        { filter: { $nor: [{ name: "" }, { status: !exampleObject1.status }] }, success: true, message: `"$nor with invalid conditions" should return _id a`}
    ]
};

describe('filter operators - Logical', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe.each(operatorsTable)('%s', ($operator) => {
        describe('validation', () => {
            test.each(valuesTable)('$message', async ({value, success, message, exceptions}) => {
                const filter: Filter<SchemaTest> = { [$operator]: value };

                const zodResult = filterSchema.safeParse(filter);

                if (success) {
                    expect(zodResult.success).toBe(true);
                } else {
                    expect(zodResult.success).toBe(false);
                    expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                    expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
                }

                try {
                    const result = await database.collection<SchemaTest>("schemaTest").findOne(filter, {});

                    if (success) {
                        expect(result).toBeNull();
                    } else {
                        throw "mongalayer.execute should have thrown an error";
                    }
                } catch (e) {
                    if (!success && isMongoServerError(e)) {
                        if (exceptions && exceptions.mongodb) {
                            expect(e.code).toBe(exceptions.mongodb.code);
                            expect(e.codeName).toBe(exceptions.mongodb.codeName);
                            expect(e.message).toContain(exceptions.mongodb.message);
                        } else {
                            expect(e.code).toBe(2);
                            expect(e.codeName).toBe('BadValue');
                            expect(e.message).toBe(`${$operator} argument must be an array`);
                        }
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
                    database: dbName,
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
