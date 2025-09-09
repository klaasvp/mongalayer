import { filterSchema } from '#src/schema/query';
import { Mongalayer } from '#src/core';
import { FilterTest} from '#test/data/filterTest';
import { DbTest, isMongoServerError, ValueTest } from '../helper.js';
import { beforeAll, describe, expect, test } from 'vitest';
import { SchemaTest } from '#test/data/schemaTest';
import { Db } from 'mongodb';
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { MongalayerCollectionType } from '#src/index.js';

const valuesTable: ValueTest[] = [
    { value: 42, message: `should not validate with number`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "a", message: `should not validate with string`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: true, message: `should not validate with true`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: false, message: `should not validate with false`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "false", message: `should not validate with "false"`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "true", message: `should not validate with "true"`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: 0, message: `should not validate with 0`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: null, message: `should not validate with null`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: [1, 2, 3], message: `should not validate with array`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: { key: 'value' }, message: `should not validate with object`, exceptions: {
        zod: { code: "invalid_union", message: 'Invalid input' }
    } },
    { value: "$field", message: `should validate with $path`, exceptions: {} },
    { value: { $in: [ "$field", "$otherField" ] }, message: `should validate with expression operator`, exceptions: {} },
];

const dbTestTable: DbTest[] = [
    { filter: { $expr: "$_id" }, success: true, message: `path expression with existing path should return a`},
    { filter: { $expr: { $in: [ "$_id", [ "a" ] ] } }, success: true, message: `$in expression with existing $_id should return a`},
    { filter: { $expr: { $in: [ "$_id", [ "x" ] ] } }, success: false, message: `$in expression with non-existing $_id should not return anything`},
];

describe('filter operators - $expr', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const operator = { $expr: value };

            const zodResult = filterSchema.safeParse(operator);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").findOne(operator, {});

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
        test.each(dbTestTable)('$message', async ({ filter, success }) => {
            const zodResult = filterSchema.safeParse(filter);

            // Database tests should always be a valid schema
            expect(zodResult.success).toBe(true);

            const mongaResult = await mongalayer.executeRaw({
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