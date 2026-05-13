import { UpdateSchema } from '#src/schema/update.js';
import { describe, expectTypeOf, test } from 'vitest';
import { Project } from '#test/data/project.js';


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
});