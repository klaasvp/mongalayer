import { describe, expect, test, beforeAll } from "vitest";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects } from "#test/lib/database";
import { Db } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections, MongalayerCollectionType } from "#src/core";

describe('Find', () => {
    let mongalayer: Mongalayer, projectZero: Project, database: Db;

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = { schema: projectSchema, access: [] };

        const collections: MongalayerCollections = {
            projects: projectCollection
        }
    
        projectZero = projectObjects[0];

        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    describe("limit", () => {
        test("No limit", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "find"
            }, {
                filter: {}
            }, {});

            expect(result.length).toBe(projectObjects.length);
        });

        test("Limit = 1", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "find"
            }, {
                filter: {},
                options: {
                    limit: 1        
                }
            }, {});

            expect(result.length).toBe(1);
        });

        test("Limit = 2", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "find"
            }, {
                filter: {},
                options: {
                    limit: 2        
                }
            }, {});

            expect(result.length).toBe(2);
        });
    })
});