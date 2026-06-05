import { describe, expect, test, beforeAll } from "vitest";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects } from "#test/lib/database";
import { Db } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { MongalayerCollectionType } from "#src/index.js";
import { Action } from "#src/actions/index.js";
import { parseReviver, stringifyReplacer } from "@mongalayer/core";
import { ZodError } from "zod";
import { FindOnePayload } from "#src/actions/findOne.js";
import { AggregatePayload, DeleteOnePayload, FindPayload } from "#src/client.js";

const projectCollectionName = "projects" as MongalayerCollectionType<Project>;

describe('Execute', () => {
    let mongalayer: Mongalayer, projectZero: Project, database: Db;

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = { schema: projectSchema, access: [] };

        const collections: MongalayerCollections = {
            projects: projectCollection
        };

        projectZero = projectObjects[0];

        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    describe("executeRaw", () => {
        test("findOne returns the matching document", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: projectCollectionName,
                operation: "findOne"
            }, {
                filter: { _id: projectZero._id }
            }, {});

            expect(result).toStrictEqual(projectZero);
        });

        test("find returns all documents", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: projectCollectionName,
                operation: "find"
            }, {
                filter: {}
            }, {});

            expect(result.length).toBe(projectObjects.length);
        });

        test("aggregate returns all documents", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: projectCollectionName,
                operation: "aggregate"
            }, {
                pipeline: []
            }, {});

            expect(result.length).toBe(projectObjects.length);
        });
    });

    describe("execute", () => {
        test("findOne returns a stringified document that revives to the original", async () => {
            const stringifiedPayload = JSON.stringify({ filter: { _id: projectZero._id } } satisfies FindOnePayload<Project>, stringifyReplacer);

            const stringifiedResult = await mongalayer.execute({
                database: dbName,
                collection: projectCollectionName,
                operation: "findOne"
            }, stringifiedPayload, {});

            expect(typeof stringifiedResult).toBe("string");

            const result = JSON.parse(stringifiedResult, parseReviver);

            expect(result).toStrictEqual(projectZero);
        });

        test("find returns a stringified array of documents", async () => {
            const stringifiedPayload = JSON.stringify({ filter: {}, options: { limit: 2 } } satisfies FindPayload<Project>, stringifyReplacer);

            const stringifiedResult = await mongalayer.execute({
                database: dbName,
                collection: projectCollectionName,
                operation: "find"
            }, stringifiedPayload, {});

            const result = JSON.parse(stringifiedResult, parseReviver) as Project[];

            expect(result.length).toBe(2);
        });

        test("revives Date values from the stringified payload", async () => {
            const stringifiedPayload = JSON.stringify({
                filter: { createdAt: { $lte: projectZero.createdAt } }
            } satisfies FindPayload<Project>, stringifyReplacer);

            const stringifiedResult = await mongalayer.execute({
                database: dbName,
                collection: projectCollectionName,
                operation: "find"
            }, stringifiedPayload, {});

            const result = JSON.parse(stringifiedResult, parseReviver) as Project[];

            for (const project of result) {
                expect(project.createdAt.getTime()).toBeLessThanOrEqual(projectZero.createdAt.getTime());
            }
        });

        test("aggregate returns a stringified array of documents", async () => {
            const stringifiedPayload = JSON.stringify({ pipeline: [{ $limit: 3 }] } satisfies AggregatePayload, stringifyReplacer);

            const stringifiedResult = await mongalayer.execute({
                database: dbName,
                collection: projectCollectionName,
                operation: "aggregate"
            }, stringifiedPayload, {});

            const result = JSON.parse(stringifiedResult, parseReviver) as Project[];

            expect(result.length).toBe(3);
        });
    });

    describe("executeJSON", () => {
        test("executes a single action body", async () => {
            const body = JSON.stringify({
                action: { database: dbName, collection: projectCollectionName, operation: "findOne" } as Action,
                payload: { filter: { _id: projectZero._id } } satisfies FindOnePayload<Project>
            }, stringifyReplacer);

            const stringifiedResult = await mongalayer.executeJSON(body, {});

            const result = JSON.parse(stringifiedResult, parseReviver);

            expect(result).toStrictEqual(projectZero);
        });

        test("executes a batch of actions and preserves order", async () => {
            const body = JSON.stringify([{
                action: { database: dbName, collection: projectCollectionName, operation: "findOne" } as Action,
                payload: { filter: { _id: projectZero._id } } satisfies FindOnePayload<Project>
            },
            {
                action: { database: dbName, collection: projectCollectionName, operation: "find" } as Action,
                payload: { filter: {}, options: { limit: 2 } } satisfies FindPayload<Project>
            },
            {
                action: { database: dbName, collection: projectCollectionName, operation: "aggregate" } as Action,
                payload: { pipeline: [{ $limit: 3 }] } satisfies AggregatePayload
            }], stringifyReplacer);

            const stringifiedResult = await mongalayer.executeJSON(body, {});

            const result = JSON.parse(stringifiedResult, parseReviver) as [Project, Project[], Project[]];

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);

            // First entry: findOne result
            expect(result[0]).toStrictEqual(projectZero);

            // Second entry: find result limited to 2
            expect(Array.isArray(result[1])).toBe(true);
            expect(result[1].length).toBe(2);

            // Third entry: aggregate result limited to 3
            expect(Array.isArray(result[2])).toBe(true);
            expect(result[2].length).toBe(3);
        });

        test("supports a batch of the same operation", async () => {
            const body = JSON.stringify([{
                action: { database: dbName, collection: projectCollectionName, operation: "find" } as Action,
                payload: { filter: {}, options: { limit: 1 } } satisfies FindPayload<Project>
            },
            {
                action: { database: dbName, collection: projectCollectionName, operation: "find" } as Action,
                payload: { filter: {}, options: { limit: 5 } } satisfies FindPayload<Project>
            }], stringifyReplacer);

            const stringifiedResult = await mongalayer.executeJSON(body, {});

            const result = JSON.parse(stringifiedResult, parseReviver) as [Project[], Project[]];

            expect(result[0].length).toBe(1);
            expect(result[1].length).toBe(5);
        });

        test("rejects a batch containing a non-read operation", async () => {
            const body = JSON.stringify([{
                action: { database: dbName, collection: projectCollectionName, operation: "find" } as Action,
                payload: { filter: {} } satisfies FindPayload<Project>
            },
            {
                action: { database: dbName, collection: projectCollectionName, operation: "deleteOne" } as Action,
                payload: { filter: { _id: projectZero._id } } satisfies DeleteOnePayload<Project>
            }], stringifyReplacer);

            await expect(mongalayer.executeJSON(body, {})).rejects.toBeInstanceOf(ZodError);
        });

        test("rejects a body with an unknown action shape", async () => {
            const body = JSON.stringify({
                action: { database: dbName, collection: "projects", operation: "find", extra: true } as Action,
                payload: { filter: {} } satisfies FindPayload<Project>
            }, stringifyReplacer);

            await expect(mongalayer.executeJSON(body, {})).rejects.toBeInstanceOf(ZodError);
        });
    });
});
