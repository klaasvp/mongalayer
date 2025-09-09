import { runTest, ValueTest } from '../helper.js';
import { beforeAll, describe, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongoDBDatabase } from '#test/lib/database';

const valuesTable: ValueTest[] = [
    { value: "string", message: 'should invalidate with non path', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "$path", message: 'should invalidate with $path', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: {}, message: 'should invalidate with object', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 123, message: 'should invalidate with number', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [], message: 'should invalidate with empty array', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 0 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: ["$path"], message: 'should invalidate with too small array', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 1 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: ["$path", "$path"], message: 'should validate with $path array', exceptions: {} },
    { value: ["$path", "$path", "$path"], message: 'should invalidate with too large array', exceptions: {
        mongodb: { code: 16020, codeName: "Location16020", message: "Expression $in takes exactly 2 arguments. 3 were passed in." },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [{ $avg: "$path" }, { $avg: "$path" }], message: 'should validate with nested operator array', exceptions: {} },
    { value: [{ $x: "$path" }, { $avg: "$path" }], message: 'should invalidate with invalid nested operator array', exceptions: {
        mongodb: { code: 168, codeName: "InvalidPipelineOperator", message: "Unrecognized expression '$x'" },
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: ["$path", [ "path" ]], message: 'should validate with items as string array', exceptions: {} },
    { value: ["$path", [ 1 ]], message: 'should validate with items as number array', exceptions: {} },
    { value: ["$path", [ { $avg: "$path" } ]], message: 'should validate with items as expression array', exceptions: {} },
    { value: ["$path", [ true ]], message: 'should invalidate with items as boolean array', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: ["$path", [ null ]], message: 'should invalidate with items as null array', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [[ "$path" ], "$path"], message: 'should invalidate with value as array', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
];

describe('expression operators - $in', () => {
    let database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => runTest({ $in: value }, exceptions, database));
    });
});
