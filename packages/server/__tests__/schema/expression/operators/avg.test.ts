import { ValueTest } from '../helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { Db } from 'mongodb';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Mongalayer } from '#src/core';
import { isMongoServerError } from '#test/lib/helper.js';
import { operatorSchema } from '#src/schema/expression/index.js';

const valuesTable: ValueTest[] = [
    { value: "string", message: 'should invalidate with non path', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "$path", message: 'should validate with $path', exceptions: {} },
    { value: [], message: 'should validate with empty array', exceptions: {} },
    { value: ["$path", "$path"], message: 'should validate with $path array', exceptions: {} },
    { value: [{ $avg: "$path" }, { $avg: "$path" }], message: 'should validate with nested operator array', exceptions: {} },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { $avg: "$path" }, message: 'should validate with known operator', exceptions: { } },
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

describe('expression operators - $avg', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const operator = { $avg: value };

            const zodResult = operatorSchema.safeParse(operator);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").aggregate([{
                    $match: {$expr: operator}
                }], {}).toArray();

                if (exceptions?.mongodb) {
                    throw "mongalayer.execute should have thrown an error";
                } else {
                    expect(result).toHaveLength(0);
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
});
