import { describe, expect, test, beforeAll } from "vitest";
import { Project, projectSchema } from "#test/data/project";
import { User } from "#test/data/user";
import { z } from "zod/v4";
import { ZodInvalidTypeIssue, ZodUnrecognizedKeysIssue } from "zod";
import { dbName, getMongaLayerForFilterTest, getMongoDBDatabase, projectObjects } from "#test/lib/database";
import { Db } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";

describe('Find One', () => {
    let mongalayer: Mongalayer, projectZero: Project, database: Db;

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = {
            schema: projectSchema,
            access: []
        };

        const collections: MongalayerCollections = {
            projects: projectCollection
        }
    
        projectZero = projectObjects[0];

        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForFilterTest({ debugging: true });
    });

    test("filter - _id = _id", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "projects",
            operation: "findOne",
            payload: {
                filter: {
                    _id: projectZero._id
                }
            }
        }, {});

        expect(result).toStrictEqual(projectZero);
    });

    test("filter - _id $in [ _id ]", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "projects",
            operation: "findOne",
            payload: {
                filter: {
                    _id: { $in: [ projectZero._id ] }
                }
            }
        }, {});

        expect(result).toStrictEqual(projectZero);
    });

    test("filter - $text.[idontexistprop] _id", async () => {
        try {
            await mongalayer.execute<User>({
                database: dbName,
                collection: "projects",
                operation: "findOne",
                payload: {
                    filter: {
                        $text: { 
                            $search: "test",
                            // @ts-expect-error - This is supposed to trigger a validation error
                            idontexistprop: projectZero._id
                        }
                    }
                }
            }, {});
        } catch (e) {
            expect(e).toBeInstanceOf(z.ZodError);
            
            let zodError = (e as z.ZodError)
            
            expect(zodError.issues[0].code).toBe("unrecognized_keys");
            expect((zodError.issues[0] as ZodUnrecognizedKeysIssue).keys).toStrictEqual(["idontexistprop"]);
        }
    });

    test("filter - $text.$search missing", async () => {
        try {
            await mongalayer.execute<User>({
                database: dbName,
                collection: "projects",
                operation: "findOne",
                payload: {
                    filter: {
                        // @ts-expect-error - This is supposed to trigger a validation error
                        $text: { }
                    }
                }
            }, {});
        } catch (e) {
            expect(e).toBeInstanceOf(z.ZodError);
            
            let zodError = (e as z.ZodError)
            
            expect(zodError.issues[0].code).toBe("invalid_type");
            expect((zodError.issues[0] as unknown as ZodInvalidTypeIssue).expected).toBe("string");
            expect((zodError.issues[0] as unknown as ZodInvalidTypeIssue).received).toBeUndefined();
        }
    });
});