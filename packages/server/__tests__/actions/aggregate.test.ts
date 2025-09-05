import { describe, expect, test, beforeAll } from "vitest";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects } from "#test/lib/database";
import { Db, Document } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { MongalayerCollectionType } from "#src/index.js";

describe('Aggregate', () => {
    let mongalayer: Mongalayer, projectZero: Project, database: Db, projectsNewToOld: Project[];

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = { schema: projectSchema, access: [] };

        const collections: MongalayerCollections = {
            projects: projectCollection
        }
    
        projectZero = projectObjects[0];
        projectsNewToOld = projectObjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    describe("limit", () => {
        test("No limit", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: []
            }, {});

            expect(result.length).toBe(projectObjects.length);
        });

        test("Limit = 1", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $limit: 1 }]
            }, {});

            expect(result.length).toBe(1);
        });

        test("Limit = 2", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $limit: 2 }]
            }, {});

            expect(result.length).toBe(2);
        });
    })
    
    describe("sort", () => {
        test("Sort = descending", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $sort: { createdAt: -1 } }]
            }, {});

            expect(result[0]).toStrictEqual(projectsNewToOld[0]);
            expect(result[result.length - 1]).toStrictEqual(projectsNewToOld[projectObjects.length - 1]);
        });

        test("Sort = ascending", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $sort: { createdAt: 1 } }]
            }, {});

            expect(result[0]).toStrictEqual(projectsNewToOld[projectObjects.length - 1]);
            expect(result[result.length - 1]).toStrictEqual(projectsNewToOld[0]);
        });
    });

    describe("skip", () => {
        // If sort fails these checks will most probably also fail
        test("Skip = 0", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $sort: { createdAt: -1 } }, { $skip: 0 }]
            }, {});

            expect(result[0]).toStrictEqual(projectsNewToOld[0]);
            expect(result[1]).toStrictEqual(projectsNewToOld[1]);
        });

        test("Skip = 1", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $sort: { createdAt: -1 } }, { $skip: 1 }]
            }, {});

            expect(result[0]).toStrictEqual(projectsNewToOld[1]);
            expect(result[1]).toStrictEqual(projectsNewToOld[2]);
        });

        test("Skip = 2", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $sort: { createdAt: -1 } }, { $skip: 2 }]
            }, {});

            expect(result[0]).toStrictEqual(projectsNewToOld[2]);
            expect(result[1]).toStrictEqual(projectsNewToOld[3]);
        });
    });

    describe("project", () => {
        test("Name only", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $project: { name: 1 } }, ]
            }, {});

            result.forEach(project => {
                expect(project).toHaveProperty("name");

                expect(Object.keys(project).length).toBe(2); // Includes ID
            });
        });

        test("Name excluded", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $project: { name: 0 } }, ]
            }, {});

            result.forEach(project => {
                expect(project).not.toHaveProperty("name");

                expect(Object.keys(project).length).toBe(Object.keys(projectZero).length - 1);
            });
        });

        test("Name only, _id excluded", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $project: { name: 1, _id: 0 } }, ]
            }, {});

            result.forEach(project => {
                expect(project).toHaveProperty("name");

                expect(Object.keys(project).length).toBe(1); // Includes ID
            });
        });
    });

    describe("group", () => {
        test("Avg version", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $group: { _id: null, version: { $avg: "$version" } } }, ]
            }, {});

            const result = results[0] as Document;

            const averageVersion = projectObjects.reduce((acc, project) => acc + project.version, 0) / projectObjects.length;

            expect(result).toHaveProperty("version");
            expect(result.version).toBe(averageVersion);
        });

        test("Avg version per type", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $group: { _id: "$type", version: { $avg: "$version" } } }, ]
            }, {});

            const versionsPerType: Record<string, number[]> = {};

            projectObjects.forEach(project => {
                if (versionsPerType[project.type] === void 0) {
                    versionsPerType[project.type] = [];
                }

                versionsPerType[project.type]?.push(project.version);
            });

            const averageVersionsPerType: Record<string, number> = {};

            for (const [ type, versions ] of Object.entries(versionsPerType) as [Project["type"], number[]][]) {
                averageVersionsPerType[type] = versions.reduce((acc, version) => acc + version, 0) / versions.length;
            }
            
            results.forEach(result => {
                expect(result).toHaveProperty("_id");
                expect(result).toHaveProperty("version");
                expect(result.version).toBe(averageVersionsPerType[result._id]);
            })
        });
    });

    describe("unwind", () => {
        test("Owners project count", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $unwind: "$access.owners" }, { $group: { _id: "$access.owners", count: { $count: {} } } }]
            }, {});

            const ownersProjectCounts: Record<string, number> = {};

            projectObjects.forEach(project => {
                project.access.owners.forEach(owner => {
                    if (ownersProjectCounts[owner] === void 0) {
                        ownersProjectCounts[owner] = 0;
                    }

                    ownersProjectCounts[owner]++;
                });
            });

            results.forEach(result => {
                expect(result).toHaveProperty("_id");
                expect(result).toHaveProperty("count");

                expect(result.count).toBe(ownersProjectCounts[result._id]);
            })
        });
    });
});