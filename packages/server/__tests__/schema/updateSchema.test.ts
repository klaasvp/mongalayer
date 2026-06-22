import { updateSchema } from '#src/schema/update.js';
import { Mongalayer } from '#src/core';
import { isMongoInvalidArgumentError, isMongoServerError, ValueTest } from './filters/helper.js';
import { SchemaTest } from '#test/data/schemaTest';
import { beforeAll, describe, expect, test } from 'vitest';
import { getMongaLayerForFilterTest, getMongoDBDatabase } from '#test/lib/database';
import { Db } from 'mongodb';
import z from 'zod';

const valuesTable: ValueTest[] = [
    { value: 1, message: 'should invalidate with number', exceptions: {
        mongoapi: { message: "Document must be a valid JavaScript object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received number' }
    } },
    { value: "a", message: 'should invalidate with string', exceptions: {
        mongoapi: { message: "Document must be a valid JavaScript object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received string' }
    } },
    { value: true, message: 'should invalidate with boolean', exceptions: {
        mongoapi: { message: "Document must be a valid JavaScript object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received boolean' }
    } },
    { value: null, message: 'should invalidate with null', exceptions: {
        mongoapi: { message: "Document must be a valid JavaScript object" },
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received null' }
    } },
    { value: [], message: 'should invalidate with array', exceptions: {
        mongoapi: { message: "Update document requires atomic operators" }, 
        zod: { code: 'invalid_type', message: 'Invalid input: expected object, received array' }
    } },
    { value: {}, message: 'should validate with empty object', exceptions: {
        mongoapi: { message: "Update document requires atomic operators" }, 
        zod: { code: 'custom', message: 'Update document requires at least one atomic operator' }
    } },
    
    // $set tests
    { value: { $set: { name: "new name" } }, message: 'should validate with $set string', exceptions: {} },
    { value: { $set: { flags: 42 } }, message: 'should validate with $set number', exceptions: {} },
    { value: { $set: { active: true } }, message: 'should validate with $set boolean', exceptions: {} },
    { value: { $set: { metadata: null } }, message: 'should validate with $set null', exceptions: {} },
    { value: { $set: { "details.metadata.updatedAt": "2024-01-01" } }, message: 'should validate with $set nested field', exceptions: {} },
    { value: { $set: { tags: ["new", "tags"] } }, message: 'should validate with $set array', exceptions: {} },
    { value: { $set: { complex: { nested: { object: true } } } }, message: 'should validate with $set complex object', exceptions: {} },
    { value: { $set: { name: "new name", flags: 10, active: false } }, message: 'should validate with $set multiple fields', exceptions: {} },
    { value: { $set: { name: "new name", "details.metadata.updatedAt": "2024-01-01", tags: ["tag1", "tag2"] } }, message: 'should validate with $set multiple diverse fields', exceptions: {} },
    { value: { $set: { $ne: null } }, message: 'should invalidate with $set dollar property at root', exceptions: {
        mongoapi: { message: "Update document requires atomic operators" }, 
        zod: { code: 'invalid_key', message: 'Invalid key in record' }
    } },
    { value: { $set: { metadata: { $ne: null } } }, message: 'should invalidate with $set dollar property in nested object', exceptions: {
        mongoapi: { message: "Update document requires atomic operators" }, 
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $set: { "$details.metadata.updatedAt": "2024-01-01" } }, message: 'should invalidate with $set dollar property on dot notation', exceptions: {
        mongoapi: { message: "Update document requires atomic operators" }, 
        zod: { code: 'invalid_key', message: 'Invalid key in record' }
    } },
    
    // $inc tests
    { value: { $inc: { flags: 1 } }, message: 'should validate with $inc positive number', exceptions: {} },
    { value: { $inc: { flags: 1, "details.count": 5 } }, message: 'should validate with $inc multiple properties', exceptions: {} },
    { value: { $inc: { flags: -1 } }, message: 'should validate with $inc negative number', exceptions: {} },
    { value: { $inc: { "details.count": 5 } }, message: 'should validate with $inc nested field', exceptions: {} },
    { value: { $inc: { flags: 0 } }, message: 'should validate with $inc zero', exceptions: {} },
    { value: { $inc: { flags: 1.5 } }, message: 'should validate with $inc decimal', exceptions: {} },
    { value: { $inc: { flags: "1" } }, message: 'should invalidate with $inc string', exceptions: {
        mongodb: { code: 14, codeName: undefined, message: "Cannot increment with non-numeric argument: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received string' }
    } },
    { value: { $inc: { flags: true } }, message: 'should invalidate with $inc boolean', exceptions: {
        mongodb: { code: 14, codeName: undefined, message: "Cannot increment with non-numeric argument: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received boolean' }
    } },
    { value: { $inc: { flags: null } }, message: 'should invalidate with $inc null', exceptions: {
        mongodb: { code: 14, codeName: undefined, message: "Cannot increment with non-numeric argument: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received null' }
    } },
    { value: { $inc: { flags: [] } }, message: 'should invalidate with $inc array', exceptions: {
        mongodb: { code: 14, codeName: undefined, message: "Cannot increment with non-numeric argument: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received array' }
    } },
    { value: { $inc: { flags: {} } }, message: 'should invalidate with $inc object', exceptions: {
        mongodb: { code: 14, codeName: undefined, message: "Cannot increment with non-numeric argument: " },
        zod: { code: 'invalid_type', message: 'Invalid input: expected number, received object' }
    } },
    
    // $unset tests
    { value: { $unset: { name: "" } }, message: 'should validate with $unset empty string', exceptions: {} },
    { value: { $unset: { name: true } }, message: 'should validate with $unset true', exceptions: {} },
    { value: { $unset: { name: 1 } }, message: 'should validate with $unset 1', exceptions: {} },
    { value: { $unset: { "details.metadata.tags": "" } }, message: 'should validate with $unset nested field', exceptions: {} },
    { value: { $unset: { name: "", active: true, "details.metadata.updatedAt": 1 } }, message: 'should validate with $unset multiple fields', exceptions: {} },
    { value: { $unset: { name: false } }, message: 'should invalidate with $unset false', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: 0 } }, message: 'should invalidate with $unset 0', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: 2 } }, message: 'should invalidate with $unset 2', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: "text" } }, message: 'should invalidate with $unset non-empty string', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: null } }, message: 'should invalidate with $unset null', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: [] } }, message: 'should invalidate with $unset array', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $unset: { name: {} } }, message: 'should invalidate with $unset object', exceptions: {
        mongoapi: { message: "Invalid unset value: " },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    
    // Combined operations
    { value: { $set: { name: "new name" }, $inc: { flags: 1 } }, message: 'should validate with $set and $inc', exceptions: {} },
    { value: { $set: { name: "new name" }, $unset: { active: true } }, message: 'should validate with $set and $unset', exceptions: {} },
    { value: { $inc: { flags: 1 }, $unset: { active: "" } }, message: 'should validate with $inc and $unset', exceptions: {} },
    { value: { $set: { name: "new name" }, $inc: { flags: 1 }, $unset: { active: 1 } }, message: 'should validate with all operations', exceptions: {} },
    
    // $push tests
    { value: { $push: { tags: "new tag" } }, message: 'should validate with $push string', exceptions: {} },
    { value: { $push: { tags: 42 } }, message: 'should validate with $push number', exceptions: {} },
    { value: { $push: { active: true } }, message: 'should validate with $push boolean', exceptions: {} },
    { value: { $push: { tags: null } }, message: 'should validate with $push null', exceptions: {} },
    { value: { $push: { tags: ["a", "b"] } }, message: 'should validate with $push array', exceptions: {} },
    { value: { $push: { items: { id: 1, name: "item" } } }, message: 'should validate with $push object', exceptions: {} },
    { value: { $push: { items: { id: 1, nested: { deep: true } } } }, message: 'should validate with $push nested object', exceptions: {} },
    { value: { $push: { "details.history": "entry" } }, message: 'should validate with $push dot notation', exceptions: {} },
    { value: { $push: { tags: "a", scores: 1 } }, message: 'should validate with $push multiple fields', exceptions: {} },
    { value: { $push: { tags: { $each: ["a", "b"] } } }, message: 'should validate with $push $each modifier', exceptions: {} },
    { value: { $push: { tags: { $each: [] } } }, message: 'should validate with $push $each empty array', exceptions: {} },
    { value: { $push: { tags: { $each: ["a", "b"], $slice: 5 } } }, message: 'should validate with $push $each and $slice', exceptions: {} },
    { value: { $push: { tags: { $each: ["a", "b"], $slice: -3 } } }, message: 'should validate with $push $each and negative $slice', exceptions: {} },
    { value: { $push: { tags: { $each: ["a", "b"], $position: 0 } } }, message: 'should validate with $push $each and $position', exceptions: {} },
    { value: { $push: { tags: { $each: ["c", "a", "b"], $sort: 1 } } }, message: 'should validate with $push $each and $sort ascending', exceptions: {} },
    { value: { $push: { tags: { $each: ["c", "a", "b"], $sort: -1 } } }, message: 'should validate with $push $each and $sort descending', exceptions: {} },
    { value: { $push: { items: { $each: [{ id: 1 }, { id: 2 }], $sort: { id: 1 } } } }, message: 'should validate with $push $each and $sort by field', exceptions: {} },
    { value: { $push: { items: { $each: [{ id: 1 }], $position: 1, $slice: 10, $sort: { id: -1 } } } }, message: 'should validate with $push all modifiers', exceptions: {} },
    { value: { $push: { tags: { $slice: 5 } } }, message: 'should invalidate with $push $slice without $each', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $push: { tags: { $each: "a" } } }, message: 'should invalidate with $push $each non-array', exceptions: {
        mongodb: { code: 2, codeName: undefined, message: "$each" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $push: { tags: { $each: ["a"], $unknown: 1 } } }, message: 'should invalidate with $push unknown modifier', exceptions: {
        mongodb: { code: 2, codeName: undefined, message: "Unrecognized clause in $push" },
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },
    { value: { $push: { metadata: { $ne: null } } }, message: 'should invalidate with $push dollar property in value', exceptions: {
        zod: { code: 'invalid_union', message: 'Invalid input' }
    } },

    // $pull tests
    { value: { $pull: { tags: "old tag" } }, message: 'should validate with $pull value', exceptions: {} },
    { value: { $pull: { scores: 80 } }, message: 'should validate with $pull number', exceptions: {} },
    { value: { $pull: { active: true } }, message: 'should validate with $pull boolean', exceptions: {} },
    { value: { $pull: { tags: null } }, message: 'should validate with $pull null', exceptions: {} },
    { value: { $pull: { items: { id: 1 } } }, message: 'should validate with $pull object value', exceptions: {} },
    { value: { $pull: { scores: { $gte: 80 } } }, message: 'should validate with $pull condition', exceptions: {} },
    { value: { $pull: { scores: { $gte: 80, $lte: 100 } } }, message: 'should validate with $pull multiple conditions', exceptions: {} },
    { value: { $pull: { scores: { $ne: 0 } } }, message: 'should validate with $pull $ne condition', exceptions: {} },
    { value: { $pull: { tags: { $in: ["a", "b"] } } }, message: 'should validate with $pull $in condition', exceptions: {} },
    { value: { $pull: { "details.tags": "old" } }, message: 'should validate with $pull dot notation', exceptions: {} },
    { value: { $pull: { tags: "a", scores: { $gt: 5 } } }, message: 'should validate with $pull multiple fields', exceptions: {} },
    { value: { $pull: { scores: { $foo: 1 } } }, message: 'should invalidate with $pull unknown operator', exceptions: {
        mongodb: { code: 2, codeName: undefined, message: "unknown top level operator: $foo" },
        zod: { code: 'custom', message: 'Invalid filter operator' }
    } },

    // Unknown operators
    { value: { $addToSet: { tags: "unique tag" } }, message: 'should invalidate with unknown $addToSet operation', exceptions: {
        mongoapi: { message: "Unknown update operator: " },
        zod: { code: 'unrecognized_keys', message: 'Unrecognized key: "$addToSet"' }
    } },
    { value: { $unknown: { tags: "unique tag" } }, message: 'should invalidate with unknown $unknown operation', exceptions: {
        mongodb: { code: 9, message: "Unknown modifier: $unknown" },
        zod: { code: 'unrecognized_keys', message: 'Unrecognized key: "$unknown"' }
    } },
];

describe('update', () => {
    let mongalayer: Mongalayer, database: Db;

    beforeAll(async () => {
        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    describe('validation', () => {
        test.each(valuesTable)('$message', async ({ value, success, message, exceptions }) => {
            const zodResult = updateSchema.safeParse(value);

            if (exceptions?.zod) {
                expect(zodResult.success).toBe(false);
                expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
                expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
            } else {
                expect(zodResult.success).toBe(true);
            }

            try {
                const result = await database.collection<SchemaTest>("schemaTest").updateOne({}, value);

                if (exceptions?.mongodb) {
                    throw "database.updateOne should have thrown an error";
                } else {
                    expect(result).toBeDefined();
                }
            } catch (e) {
                if (exceptions?.mongodb && isMongoServerError(e)) {
                    expect(e.code).toBe(exceptions?.mongodb?.code);
                    expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
                    expect(e.message).toContain(exceptions?.mongodb?.message);
                } else if (exceptions?.mongoapi && isMongoInvalidArgumentError(e)) {
                    expect(e.message).toContain(exceptions?.mongoapi?.message);
                } else {
                    throw e;
                }
            }
        });
    });
});