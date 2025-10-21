import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { JwtPayload } from "jsonwebtoken";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectAssetObjects, projectObjects, userObjects } from "#test/lib/database";
import { AccessAlternativeCollection, MongalayerCollectionType } from "#src/index.js";
import { ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";

describe('Access - Filter', () => {
    describe('Schema missing', () => {
        let mongalayer: Mongalayer, userZero: User;

        beforeAll(async () => {
            const collections: MongalayerCollections = {}
        
            userZero = userObjects[0];

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("random test", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {}
            }, {});

            expect(result).toStrictEqual(userZero);
        });
    });

    describe('Access empty', () => {
        let mongalayer: Mongalayer, userZero: User;

        beforeAll(async () => {
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: []
                }
            }
        
            userZero = userObjects[0];
        
            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("findOne - No filters", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {}
            }, {});

            expect(result).toStrictEqual(userZero);
        });

        test("findOne - _id filter - existing", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne",
            }, {
                filter: {
                    _id: userZero._id
                }
            }, {});

            expect(result).toStrictEqual(userZero);
        });

        test("findOne - _id filter - non-existing", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {
                    _id: "abc"
                }
            }, {});

            expect(result).toStrictEqual(null);
        });
    });

    describe('Access user', () => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, userOne: User;

        beforeAll(async () => {
            const userCollection: MongalayerCollection<User> = {
                schema: userSchema,
                access: [{
                    role: "self",
                    filter: {
                        _id: "%%user.sub"
                    }
                }]
            };

            const collections: MongalayerCollections = {
                users: userCollection
            }
        
            userZero = userObjects[0];
            userOne = userObjects[1];

            userZeroAccessPayload = {
                user: {
                    sub: userZero._id
                }
            };

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("findOne - self filter", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {
                    _id: userZero._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(userZero);
        });

        test("findOne - other filter", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {
                    _id: userOne._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(null);
        });
    });

    describe('Access project - user owner', () => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, projectWithoutUserAsOwner: Project, projectWithUserAsOwner: Project;

        beforeAll(async () => {
            const projectCollection: MongalayerCollection<Project> = {
                schema: projectSchema,
                access: [{
                    role: "owner",
                    filter: {
                        "access.owners": {"$in":["%%user.sub"]}
                    }
                }]
            };

            const collections: MongalayerCollections = {
                projects: projectCollection
            }
        
            userZero = userObjects[0];
            userZeroAccessPayload = {
                user: {
                    sub: userZero._id
                }
            };

            projectWithUserAsOwner = projectObjects.find(project => project.access.owners.includes(userZero._id))!;
            projectWithoutUserAsOwner = projectObjects.find(project => !project.access.owners.includes(userZero._id))!;

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("findOne - project as owner = project", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "findOne"
            }, {
                filter: {
                    _id: projectWithUserAsOwner._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(projectWithUserAsOwner);
        });

        test("findOne - project not as owner = null", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "findOne"
            }, {
                filter: {
                    _id: projectWithoutUserAsOwner._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(null);
        });
    });

    describe.each<{ collection: AccessAlternativeCollection<ProjectAsset, any>, desc: "projectID" | "latestAssets" | "unfinishedAssets" }>([
        { collection: {
            target: "projects",
            targetField: "_id",
            localField: "projectID"
        }, desc: "projectID" },
        { collection: {
            target: "projects",
            targetField: "latestAssets",
            localField: "_id"
        }, desc: "latestAssets" },
        { collection: {
            target: "projects",
            targetField: "id",
            targetFieldArrayPath: "unfinishedAssets",
            localField: "_id"
        }, desc: "unfinishedAssets" }
    ])('Access project asset - user owner (via project - $desc)', ({ collection: alternativeCollection, desc }) => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, projectAssetWithoutUserAsOwner: ProjectAsset, projectAssetWithUserAsOwner: ProjectAsset;

        beforeAll(async () => {
            const projectAssetCollection: MongalayerCollection<ProjectAsset> = {
                schema: projectAssetSchema,
                access: [{
                    role: "owner",
                    filter: {
                        "access.owners": {"$in":["%%user.sub"]}
                    },
                    collection: alternativeCollection
                }]
            };

            const collections: MongalayerCollections = {
                projectAssets: projectAssetCollection
            }
        
            userZero = userObjects[0];
            userZeroAccessPayload = {
                user: {
                    sub: userZero._id
                }
            };

            const 
                projectWithUserAsOwner = projectObjects.find(project => project.access.owners.includes(userZero._id))!,
                projectWithoutUserAsOwner = projectObjects.find(project => !project.access.owners.includes(userZero._id))!;

            const db = await getMongoDBDatabase();

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });

            if (desc === "projectID") {
                projectAssetWithUserAsOwner = projectAssetObjects.find(pa => pa.projectID === projectWithUserAsOwner._id)!;
                projectAssetWithoutUserAsOwner = projectAssetObjects.find(pa => pa.projectID === projectWithoutUserAsOwner._id)!;
            } else if (desc === "latestAssets") {
                projectAssetWithUserAsOwner = projectAssetObjects.find(pa => pa._id === projectWithUserAsOwner.latestAssets[0])!;
                projectAssetWithoutUserAsOwner = projectAssetObjects.find(pa => pa._id === projectWithoutUserAsOwner.latestAssets[0])!;
            } else if (desc === "unfinishedAssets") {
                projectAssetWithUserAsOwner = projectAssetObjects.find(pa => pa._id === projectWithUserAsOwner.unfinishedAssets[0]?.id)!;
                projectAssetWithoutUserAsOwner = projectAssetObjects.find(pa => pa._id === projectWithoutUserAsOwner.unfinishedAssets[0]?.id)!;
            }
        });

        test("findOne - project asset as owner = project", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projectAssets" as MongalayerCollectionType<Project>,
                operation: "findOne"
            }, {
                filter: {
                    _id: projectAssetWithUserAsOwner._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(projectAssetWithUserAsOwner);
        });

        test("findOne - project asset not as owner = null", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projectAssets" as MongalayerCollectionType<Project>,
                operation: "findOne"
            }, {
                filter: {
                    _id: projectAssetWithoutUserAsOwner._id
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(null);
        });

        test("aggregate - count project assets as owner", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projectAssets" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [ 
                    { $group: { _id: null, count: { $count: {} } } },
                    { $project: { _id: 0 } }
                ]
            }, userZeroAccessPayload) as { count: number }[];

            let userZeroProjectAssetsLength = 0;

            const 
                userZeroProjects = projectObjects.filter(project => project.access.owners.includes(userZero._id)),
                userZeroProjectIDs = userZeroProjects.map(p => p._id);
                
            if (desc === "projectID") {
                userZeroProjectAssetsLength = projectAssetObjects.filter(pa => userZeroProjectIDs.includes(pa.projectID)).length;
            } else if (desc === "latestAssets") {
                userZeroProjectAssetsLength = userZeroProjects.reduce((assetIDs, project) => {
                    assetIDs.push(...project.latestAssets.filter(la => !assetIDs.includes(la)));
                    return assetIDs;
                }, [] as string[]).length;
            } else if (desc === "unfinishedAssets") {
                userZeroProjectAssetsLength = userZeroProjects.reduce((assetIDs, project) => {
                    assetIDs.push(...project.unfinishedAssets.map(ua => ua.id).filter(id => !assetIDs.includes(id)));
                    return assetIDs;
                }, [] as string[]).length;
            }

            expect(result.length).toBe(1);
            
            if (result.length === 1) {
                expect(result[0].count).toBe(userZeroProjectAssetsLength);
            }
        });

        test("aggregate - match project asset as owner", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projectAssets" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [ 
                    { $match: { _id: projectAssetWithUserAsOwner._id } },
                    { $group: { _id: null, count: { $count: {} } } },
                    { $project: { _id: 0 } }
                ]
            }, userZeroAccessPayload) as { count: number }[];

            expect(result.length).toBe(1);
            
            if (result.length === 1) {
                expect(result[0].count).toBe(1);
            }
        });

        test("aggregate - match project asset not as owner", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projectAssets" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [ 
                    { $match: { _id: projectAssetWithoutUserAsOwner._id } },
                    { $group: { _id: null, count: { $count: {} } } },
                    { $project: { _id: 0 } } 
                ] 
            }, userZeroAccessPayload) as { count: number }[];

            expect(result.length).toBe(0);
        });
    });
});