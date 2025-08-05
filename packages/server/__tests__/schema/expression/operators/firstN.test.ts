import { runTest, ValueTest } from '../helper.js';
import { beforeAll, describe, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: { input: "$path" }, message: 'should invalidate with missing n', exceptions: {
        mongodb: { code: 5787906, codeName: "Location5787906", message: 'Missing value for \'n\'' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { n: "$path" }, message: 'should invalidate with missing input', exceptions: {
        mongodb: { code: 5787907, codeName: "Location5787907", message: 'Missing value for \'input\'' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { input: "$path", n: "$path" }, message: 'should validate with $path', exceptions: {} },
    { value: { input: {$first: "$path"}, n: {$last: "$path"} }, message: 'should validate with nested $path', exceptions: {} },
    { value: { input: [{ $first: "$path" }, { $last: "$path" }], n: "$path" }, message: 'should invalidate with nested operator array', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "$path", message: 'should invalidate with $path', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        mongodb: { code: 5787906, codeName: "Location5787906", message: 'Missing value for \'n\'' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $x: "$path" }, message: 'should invalidate with unknown operator', exceptions: {
        mongodb: { code: 5787901, codeName: "Location5787901", message: 'Unknown argument for \'n\' ' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "string", message: 'should invalidate with non path', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }} 
    },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 5787801, codeName: "Location5787801", message: 'specification must be an object; found' },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } }
];

describe('expression operators - $firstN', () => {
    let database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => runTest({ $firstN: value }, exceptions, database));
    });
});
