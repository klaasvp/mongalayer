import { filterOperatorsSchema, filterSchema } from '#src/schema/query';
import { Mongalayer } from '#src/core';
import { exampleObject1, FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { MongalayerCollectionType } from '#src/index.js';

type Operator = "$bitsAllClear" | "$bitsAllSet" | "$bitsAnyClear" | "$bitsAnySet";

const operatorsTable: [Operator][] = [
    ["$bitsAllClear"],
    ["$bitsAllSet"],
    ["$bitsAnyClear"],
    ["$bitsAnySet"]
];

const valuesTable: ValueTest[] = [
    { value: 123, message: 'should validate with number', exceptions: {} },
    { value: [1, 2, 3], message: 'should validate with array of numbers', exceptions: {} },
    { value: [], message: 'should validate with empty array', exceptions: {} },
    { value: "123", message: 'should invalidate with string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "property takes an Array, a number, or a BinData but received: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: ["1"], message: 'should validate with array of string', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse bit position. Expected a number in:" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "property takes an Array, a number, or a BinData but received: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [true], message: 'should validate with array of boolean', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse bit position. Expected a number in:" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "property takes an Array, a number, or a BinData but received: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [null], message: 'should validate with array of null', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse bit position. Expected a number in:" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {},  message: 'should invalidate with object', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "property takes an Array, a number, or a BinData but received: " },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [{}], message: 'should invalidate with array of objects', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Failed to parse bit position. Expected a number in:" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

const dbTestTable: Record<Operator, DbTest[]> = {
    $bitsAllClear: [
        { filter: { flags: { $bitsAllClear: 18 } }, success: true, message: 'should validate with $bitsAllClear: 18' },
        { filter: { flags: { $bitsAllClear: 10 } }, success: false, message: 'should not validate with $bitsAllClear: 10' },
        { filter: { flags: { $bitsAllClear: [ 1, 5 ] } }, success: true, message: 'should validate with $bitsAllClear: [ 1, 5 ]' },
        { filter: { flags: { $bitsAllClear: [ 1, 6 ] } }, success: false, message: 'should not validate with $bitsAllClear: [ 1, 6 ]' },
    ],
    $bitsAllSet: [
        { filter: { flags: { $bitsAllSet: 12 } }, success: true, message: 'should validate with $bitsAllSet: 12' },
        { filter: { flags: { $bitsAllSet: 10 } }, success: false, message: 'should not validate with $bitsAllSet: 10' },
        { filter: { flags: { $bitsAllSet: [ 2, 3 ] } }, success: true, message: 'should validate with $bitsAllSet: [ 2, 3 ]' },
        { filter: { flags: { $bitsAllSet: [ 2, 4 ] } }, success: false, message: 'should not validate with $bitsAllSet: [ 2, 4 ]' },
    ],
    $bitsAnyClear: [
        { filter: { flags: { $bitsAnyClear: 3 } }, success: true, message: 'should validate with $bitsAnyClear: 3' },
        { filter: { flags: { $bitsAnyClear: 5 } }, success: false, message: 'should not validate with $bitsAnyClear: 5' },
        { filter: { flags: { $bitsAnyClear: [ 0, 1 ] } }, success: true, message: 'should validate with $bitsAnyClear: [ 0, 1 ]' },
        { filter: { flags: { $bitsAnyClear: [ 0, 2 ] } }, success: false, message: 'should not validate with $bitsAnyClear: [ 0, 2 ]' },
    ],
    $bitsAnySet: [
        { filter: { flags: { $bitsAnySet: 3 } }, success: true, message: 'should validate with $bitsAnySet: 12' },
        { filter: { flags: { $bitsAnySet: 18 } }, success: false, message: 'should not validate with $bitsAnySet: 10' },
        { filter: { flags: { $bitsAnySet: [ 0, 1 ] } }, success: true, message: 'should validate with $bitsAnySet: [ 0, 1 ]' },
        { filter: { flags: { $bitsAnySet: [ 1, 4 ] } }, success: false, message: 'should not validate with $bitsAnySet: [ 1, 4 ]' },
    ]
};

describe('filter operators - bitwise', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe.each(operatorsTable)('%s', ($operator) => {
        describe('validation', () => {
            test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
                const operator = { [$operator]: value };

                const zodResult = filterOperatorsSchema.safeParse(operator);

                if (exceptions?.zod) {
                    expect(zodResult.success).toBe(false);
                    expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                    expect(zodResult.error!.issues[0].message).toBe(exceptions?.zod?.message);
                } else {
                    expect(zodResult.success).toBe(true);
                }

                try {
                    const result = await database.collection<SchemaTest>("schemaTest").findOne({
                        property: operator
                    }, {});

                    if (exceptions?.mongodb) {
                        throw "mongalayer.execute should have thrown an error";
                    } else {
                        expect(result).toBeNull();
                    }
                } catch (e) {
                    if (exceptions?.mongodb && isMongoServerError(e)) {
                        expect(e.code).toBe(exceptions?.mongodb?.code);
                        expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
                        expect(e.message).toContain(exceptions?.mongodb?.message);
                    } else {
                        throw e;
                    }
                }
            });
        });

        describe('on filterTestSolo collection', () => {
            test.each(dbTestTable[$operator])('$message', async ({ filter, success, message }) => {
                const zodResult = filterSchema.safeParse(filter);

                expect(zodResult.success).toBe(true);

                const mongaResult = await mongalayer.executeRaw({
                    database: dbName,
                    collection: "filterTestSolo" as MongalayerCollectionType<FilterTest>,
                    operation: "findOne"
                }, { filter }, {});

                if (success) {
                    expect(mongaResult).toBeDefined();
                    expect(mongaResult).toHaveProperty('name', exampleObject1.name);
                } else {
                    expect(mongaResult).toBeNull();
                }
            });
        });
    });
});
