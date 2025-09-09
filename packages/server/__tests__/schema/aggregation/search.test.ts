import { Mongalayer } from '#src/core';
import { ValueTest } from './helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import { isMongoServerError } from '#test/lib/helper.js';
import { searchSchema } from '#src/schema/aggregation/search.js';

// Note: mongo-memory-server doesn't support $search as it's an atlas specific product, so it's not possible to test the schema on the memory database.

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received array' }
    } },
    { value: {}, message: 'should invalidate with empty object', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $avg: 1 }, message: 'should invalidate with root operator', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { test: { test: "string" } }, message: 'should invalidate with unknown key', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { index: "string", text: { query: "x", path: "y" } }, message: 'should validate with index = string & text search', exceptions: {} },
    { value: { index: "string" }, message: 'should invalidate with only index = string', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { index: 1, text: { query: "x", path: "y" } }, message: 'should invalidate with index != string', exceptions: {
        zod: { code: 'invalid_type', message: 'Invalid input' }
    } },
    { value: { text: { query: "x", path: "y" } }, message: 'should validate with no index & text search', exceptions: {} },
    { value: { text: { 
        query: "x", 
        path: "y",
        matchCriteria: "all",
        fuzzy: { maxEdits: 1, prefixLength: 3, maxExpansions: 2 },
        score: { boost: { value: 1.5 } },
        synonyms: "z"
    } }, message: 'should validate with text search with options', exceptions: {} },
    { value: { autocomplete: { 
        query: "x", 
        path: "y",
        matchCriteria: "sequential",
        fuzzy: { maxEdits: 1, prefixLength: 3, maxExpansions: 2 },
        score: { boost: { value: 1.5} },
    } }, message: 'should validate with autocomplete search with options', exceptions: {} },
    { value: { text: { 
        query: "x", 
        path: "y",
        score: { boost: { path: "z", undefined: 2 } },
    } }, message: 'should validate with score -> boost -> path', exceptions: {} },
    { value: { text: { 
        query: "x", 
        path: "y",
        score: { constant: { value: 2 } },
    } }, message: 'should validate with score -> constant', exceptions: {} },
    { value: { 
        compound: {
            should: [
                { text: { query: "a", path: "x" } },
                { autocomplete: { query: "b", path: "z" } }
            ]
        }
    }, message: 'should validate simple compound', exceptions: {} },
    { value: { 
        compound: {
            abc: [
                { text: { query: "a", path: "x" } }
            ]
        }
    }, message: 'should invalidate compound with invalid compound operator', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { 
        compound: {
            should: []
        }
    }, message: 'should invalidate compound with empty compound operator', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { 
        compound: {
            score: { constant: { value: 1 } },
            should: [
                { text: { query: "a", path: "x" } }
            ]
        }
    }, message: 'should validate simple compound with score', exceptions: {} },
    { value: { 
        compound: {
            must: [ { text: { query: "a", path: "x" } } ],
            mustNot: [ { text: { query: "a", path: "x" } } ],
            should: [ { text: { query: "a", path: "x" } } ],
            filter: [ { text: { query: "a", path: "x" } } ]
        }
    }, message: 'should validate combined compound', exceptions: {} },
];

describe('search', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, exceptions }) => {
            const zodResult = searchSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }
        });
    });
});
