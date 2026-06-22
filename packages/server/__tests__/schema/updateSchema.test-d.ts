import { UpdateSchema } from '#src/schema/update.js';
import { describe, expectTypeOf, test } from 'vitest';
import { Project } from '#test/data/project.js';
import { JSONValue } from '#src/schema/index.js';
import z from 'zod';
import { filterOperatorsSchema } from '#src/schema/query.js';


describe('update', () => {
    test('UpdateSchema type', () => {
        const update: UpdateSchema = {$set:{}};

        expectTypeOf(update.$set!).toEqualTypeOf<Required<UpdateSchema>["$set"]>();
    });

    test('UpdateSchema type', () => {
        const update: UpdateSchema<Project> = {$set: {
            "data.location.coordinates": [0, 0]
        }};

        expectTypeOf(update.$set!).toEqualTypeOf<Required<UpdateSchema<Project>>["$set"]>();
        expectTypeOf(update.$set!["data.location.coordinates"]!).toEqualTypeOf<Required<Project["data"]>["location"]["coordinates"]>();
    });

    test('UpdateSchema type', () => {
        const update: UpdateSchema<Project> = {$set:{}};

        expectTypeOf(update.$set!).not.toEqualTypeOf<Required<UpdateSchema>["$set"]>();
    });

    test('UpdateSchema $push type', () => {
        const update: UpdateSchema<Project> = { $push: {
            "config.tags": "new tag",
            latestAssets: "asset-id",
            unfinishedAssets: { id: "asset-id", status: "design", updatedAt: null }
        } };

        expectTypeOf(update.$push!["config.tags"]!).toEqualTypeOf<Project["config"]["tags"][number]>();
        expectTypeOf(update.$push!.latestAssets!).toEqualTypeOf<Project["latestAssets"][number]>();
        expectTypeOf(update.$push!.unfinishedAssets!).toEqualTypeOf<Project["unfinishedAssets"][number]>();
    });

    test('UpdateSchema $pull type', () => {
        const update: UpdateSchema<Project> = { $pull: {
            "config.tags": "old tag",
            latestAssets: { $in: ["a", "b"] }
        } };

        expectTypeOf(update.$pull!["config.tags"]!).toEqualTypeOf<Project["config"]["tags"][number] | Record<string, JSONValue> | z.infer<typeof filterOperatorsSchema>>();
    });
});