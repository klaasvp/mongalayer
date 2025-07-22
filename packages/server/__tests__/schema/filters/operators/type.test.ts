import { z } from 'zod/v4';
import { filterOperatorsSchema, filterSchema } from '#src/actions/schema';
import { Mongalayer } from '#src/core';
import { FilterTest } from '#test/data/filterTest';
import { DbTest, isMongoServerError } from '../helper.js';
import { BSONType, Db } from 'mongodb';
import { beforeAll, describe, expect, test } from 'vitest';
import { SchemaTest } from '#test/data/schemaTest';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';

const typesTable = [
    { type: BSONType.double, success: true, message: 'should validate with double' },
    { type: BSONType.string, success: true, message: 'should validate with string' },
    { type: BSONType.object, success: true, message: 'should validate with object' },
    { type: BSONType.array, success: true, message: 'should validate with array' },
    { type: BSONType.binData, success: true, message: 'should validate with binData' },
    { type: BSONType.undefined, success: true, message: 'should validate with undefined' },
    { type: BSONType.objectId, success: true, message: 'should validate with objectId' },
    { type: BSONType.bool, success: true, message: 'should validate with bool' },
    { type: BSONType.date, success: true, message: 'should validate with date' },
    { type: BSONType.null, success: true, message: 'should validate with null' },
    { type: BSONType.regex, success: true, message: 'should validate with regex' },
    { type: BSONType.dbPointer, success: true, message: 'should validate with dbPointer' },
    { type: BSONType.javascript, success: true, message: 'should validate with javascript' },
    { type: BSONType.symbol, success: true, message: 'should validate with symbol' },
    { type: BSONType.javascriptWithScope, success: true, message: 'should validate with javascriptWithScope' },
    { type: BSONType.int, success: true, message: 'should validate with int' },
    { type: BSONType.timestamp, success: true, message: 'should validate with timestamp' },
    { type: BSONType.long, success: true, message: 'should validate with long' },
    { type: BSONType.decimal, success: true, message: 'should validate with decimal' },
    { type: BSONType.minKey, success: true, message: 'should validate with minKey' },
    { type: BSONType.maxKey, success: true, message: 'should validate with maxKey' },
    { type: 'string', success: true, message: 'should validate with string alias' },
    { type: 'symbol', success: true, message: 'should validate with symbol alias' },
    { type: 'undefined', success: true, message: 'should validate with undefined alias' },
    { type: 'object', success: true, message: 'should validate with object alias' },
    { type: 'array', success: true, message: 'should validate with array alias' },
    { type: 'int', success: true, message: 'should validate with int alias' },
    { type: 'null', success: true, message: 'should validate with null alias' },
    { type: 'date', success: true, message: 'should validate with date alias' },
    { type: 'double', success: true, message: 'should validate with double alias' },
    { type: 'binData', success: true, message: 'should validate with binData alias' },
    { type: 'objectId', success: true, message: 'should validate with objectId alias' },
    { type: 'bool', success: true, message: 'should validate with bool alias' },
    { type: 'regex', success: true, message: 'should validate with regex alias' },
    { type: 'dbPointer', success: true, message: 'should validate with dbPointer alias' },
    { type: 'javascript', success: true, message: 'should validate with javascript alias' },
    { type: 'javascriptWithScope', success: true, message: 'should validate with javascriptWithScope alias' },
    { type: 'timestamp', success: true, message: 'should validate with timestamp alias' },
    { type: 'long', success: true, message: 'should validate with long alias' },
    { type: 'decimal', success: true, message: 'should validate with decimal alias' },
    { type: 'minKey', success: true, message: 'should validate with minKey alias' },
    { type: 'maxKey', success: true, message: 'should validate with maxKey alias' },
    // Invalidate
    { type: 'invalidType', success: false, message: 'should invalidate with invalid string type', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Unknown type name alias: " }
    } },
    { type: -9999999999, success: false, message: 'should invalidate with invalid number type', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: "Invalid numerical type code: " }
    } },
    { type: null, success: false, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: 'type must be represented as a number or a string' }
    } },
    { type: true, success: false, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: 'type must be represented as a number or a string' }
    } },
    { type: [], success: false, message: 'should invalidate with array', exceptions: {
        mongodb: { code: 9, codeName: "FailedToParse", message: 'property must match at least one type' }
    } },
    { type: {}, success: false, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 14, codeName: "TypeMismatch", message: 'type must be represented as a number or a string' }
    } },
];

describe('filter operators - $type', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(typesTable)('$message', async ({ type, success, message, exceptions }) => {
            const operator = { $type: type };

            const zodResult = filterOperatorsSchema.safeParse(operator);

            if (success) {
                expect(zodResult.success).toBe(true);
            } else {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', z.ZodIssueCode.invalid_union);
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
    
    const dbTestTable: DbTest[] = [
        { filter: { name: { $type: "string" } }, success: true, message: `"name: string" should return _id a`},
        { filter: { name: { $type: BSONType.string } }, success: true, message: `"name: BSONType.string" should return _id a`},
        { filter: { name: { $type: "int" } }, success: false, message: `"name: int" should not return anything`},
        { filter: { name: { $type: BSONType.int } }, success: false, message: `"name: BSONType.int" should not return anything`}
    ];

    describe('on filterTestSolo collection', () => {
        test.each(dbTestTable)('$message', async ({ filter, success }) => {
            const zodResult = filterSchema.safeParse(filter);

            // Database tests should always be a valid schema
            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.execute<FilterTest>({
                database: dbName,
                collection: "filterTest",
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
