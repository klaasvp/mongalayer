import { runTest, ValueTest } from '../helper.js';
import { beforeAll, describe, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: { input: "$path" }, message: 'should invalidate with missing method', exceptions: {
        mongodb: { code: 40414, codeName: "IDLFailedToParse", message: 'BSON field \'$median.method\' is missing but a required field' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { method: "approximate" }, message: 'should invalidate with missing input', exceptions: {
        mongodb: { code: 40414, codeName: "IDLFailedToParse", message: 'BSON field \'$median.input\' is missing but a required field' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { input: "$path", method: "approximate" }, message: 'should invalidate with wrong method', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { input: "$path", method: "x" }, message: 'should invalidate with wrong method', exceptions: {
        mongodb: { code: 2, codeName: "BadValue", message: 'Currently only \'approximate\' can be used as percentile \'method\'.' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { input: {$first: "$path"}, method: "approximate" }, message: 'should invalidate with nested $path', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { input: ["$path", "$path"], method: "approximate" }, message: 'should validate with operator array', exceptions: {} },
    { value: { input: [{ $first: "$path" }, { $last: "$path" }], method: "approximate" }, message: 'should validate with nested operator array', exceptions: {} },
    { value: "$path", message: 'should invalidate with $path', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 40414, codeName: "IDLFailedToParse", message: 'BSON field \'$median.input\' is missing but a required field' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $x: "$path" }, message: 'should invalidate with unknown operator', exceptions: {
        mongodb: { code: 40415, codeName: "IDLUnknownField", message: 'BSON field \'$median.$x\' is an unknown field.' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "string", message: 'should invalidate with non path', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }} 
    },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 7436201, codeName: "Location7436201", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

describe('expression operators - $median', () => {
    let database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => runTest({ $median: value }, exceptions, database));
    });
});
