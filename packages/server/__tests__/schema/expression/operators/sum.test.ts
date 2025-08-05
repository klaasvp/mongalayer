import { runTest, ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Mongalayer } from '#src/core';

const valuesTable: ValueTest[] = [
    { value: "string", message: 'should invalidate with non path', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "$path", message: 'should invalidate with $path', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should validate with empty array', exceptions: {} },
    { value: ["$path", "$path"], message: 'should validate with $path array', exceptions: {} },
    { value: [{ $avg: "$path" }, { $avg: "$path" }], message: 'should invalidate with nested operator array', exceptions: {} },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $sum: "$path" }, message: 'should invalidate with known operator', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $x: "$path" }, message: 'should invalidate with unknown operator', exceptions: {
        mongodb: { code: 168, codeName: "InvalidPipelineOperator", message: 'Unrecognized expression ' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

describe('expression operators - $sum', () => {
    let database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => runTest({ $sum: value }, exceptions, database));
    });
});
