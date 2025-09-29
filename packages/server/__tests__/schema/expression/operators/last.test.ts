import { runTest, ValueTest } from '../helper.js';
import { beforeAll, describe, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: "string", message: 'should invalidate with non path', exceptions: {
        mongodb: { code: 28689, codeName: "Location28689", message: 'argument must be an array, but is string' },
        zod: { code: "invalid_format", message: 'Invalid string: must match pattern /^\\$/' }
    } },
    { value: "$path", message: 'should validate with $path', exceptions: {} },
    { value: ["$path"], message: 'should invalidate with [$path]', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: 'takes exactly 1 arguments. 0 were passed in.' },
        zod: { code: "invalid_union", message: 'Invalid input' }} },
    { value: ["$path", "$path"], message: 'should invalidate with $path array > 1 value', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: 'takes exactly 1 arguments. 2 were passed in.' },
        zod: { code: "invalid_union", message: 'Invalid input' }} },
    { value: [{ $last: "$path" }], message: 'should invalidate with nested operator array', exceptions: { 
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [{ $last: "$path" }, { $last: "$path" }], message: 'should invalidate with nested operator array', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: 'takes exactly 1 arguments. 2 were passed in.' },
        zod: { code: "invalid_union", message: 'Invalid input' }} },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 28689, codeName: "Location28689", message: 'argument must be an array, but is object' },
        zod: { code: "custom", message: 'Invalid input' }
    } },
    { value: { $last: "$path" }, message: 'should validate with known operator', exceptions: { } },
    { value: { $x: "$path" }, message: 'should invalidate with unknown operator', exceptions: {
        mongodb: { code: 168, codeName: "InvalidPipelineOperator", message: 'Unrecognized expression ' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 28689, codeName: "Location28689", message: 'argument must be an array, but is int' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 28689, codeName: "Location28689", message: 'argument must be an array, but is bool' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

describe('expression operators - $last', () => {
    let database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => runTest({ $last: value }, exceptions, database));
    });
});
