import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectAssetObjects, projectObjects, userObjects } from "#test/lib/database";
import { AccessAlternativeCollection } from "#src/access";
import { Db } from "mongodb";
import { ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";
import { MongalayerCollectionType } from "#src/index.js";
import { JwtPayload } from "jsonwebtoken";
import { User } from "#test/data/user.js";

describe('Access - Aggregate - Lookup', () => {
    let projectZero: Project, database: Db, userZero: User, userZeroAccessPayload: JwtPayload;

    const altCollection: Pick<AccessAlternativeCollection<ProjectAsset, Project>, "target" | "targetField" | "localField"> = {
        target: "projects",
        targetField: "_id",
        localField: "projectID"
    };

    const projectCollection: MongalayerCollection<Project> = {
        schema: projectSchema,
        access: [{
            role: "owner",
            filter: {
                "access.owners": {"$in": ["%%user.sub"]}
            }
        }, {
            role: "contributor",
            filter: {
                "access.contributors": {"$in": ["%%user.sub"]}
            }
        }, {
            role: "reader",
            filter: {
                "access.readers": {"$in": ["%%user.sub"]}
            }
        }]
    };

    beforeAll(async () => { 
        userZero = userObjects[0];
        userZeroAccessPayload = {
            user: {
                sub: userZero._id
            }
        };
        
        const userZeroProjects = projectObjects.filter(project => project.access.owners.includes(userZero._id));

        projectZero = userZeroProjects[0];

        database = await getMongoDBDatabase();
    });

    describe('Project with assets - only creator', () => {
        let mongalayer: Mongalayer;
        
        beforeAll(async () => {
            const projectAssetsCollection: MongalayerCollection<ProjectAsset> = {
                schema: projectAssetSchema,
                access: [{
                    role: "creator",
                    filter: {
                        "uploaderID": "%%user.sub"
                    },
                    collection: { ...altCollection, targetFilter: {
                        "access.owners": {"$in": ["%%user.sub"]}
                    } }
                }]
            };

            const collections: MongalayerCollections = {
                projects: projectCollection,
                projectAssets: projectAssetsCollection
            }

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("Project with assets", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{
                    $match: { _id: projectZero._id }
                },
                { 
                    $lookup: {
                        from: "projectAssets",
                        localField: "_id",
                        foreignField: "projectID",
                        as: "assets"
                    }
                }]
            }, userZeroAccessPayload) as (Project & { assets: ProjectAsset[] })[];

            const 
                projectZeroAssets = projectAssetObjects.filter(asset => asset.projectID === projectZero._id && asset.uploaderID === userZero._id),
                projectZeroAssetIDs = projectZeroAssets.map(asset => asset._id);

            expect(results).toHaveLength(1);
            expect(results[0].assets).toHaveLength(projectZeroAssets.length);
            expect(results[0].assets.map(asset => asset._id).sort()).toEqual(projectZeroAssetIDs.sort());
        });
    });

    describe('Project with assets - creator & owner', () => {
        let mongalayer: Mongalayer;
        
        beforeAll(async () => {
            const projectAssetsCollection: MongalayerCollection<ProjectAsset> = {
                schema: projectAssetSchema,
                access: [{
                    role: "creator",
                    filter: {
                        "uploaderID": "%%user.sub"
                    },
                    collection: { ...altCollection, targetFilter: {
                        "access.owners": {"$in": ["%%user.sub"]}
                    } }
                }, {
                    role: "owner",
                    filter: {},
                    collection: { ...altCollection, targetFilter: {
                        "access.owners": {"$in": ["%%user.sub"]}
                    } }
                }]
            };

            const collections: MongalayerCollections = {
                projects: projectCollection,
                projectAssets: projectAssetsCollection
            }

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("Project with assets", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{
                    $match: { _id: projectZero._id }
                },
                { 
                    $lookup: {
                        from: "projectAssets",
                        localField: "_id",
                        foreignField: "projectID",
                        as: "assets"
                    }
                }]
            }, userZeroAccessPayload) as (Project & { assets: ProjectAsset[] })[];

            const 
                projectZeroAssets = projectAssetObjects.filter(asset => asset.projectID === projectZero._id),
                projectZeroAssetIDs = projectZeroAssets.map(asset => asset._id);

            expect(results).toHaveLength(1);
            expect(results[0].assets).toHaveLength(projectZeroAssets.length);
            expect(results[0].assets.map(asset => asset._id).sort()).toEqual(projectZeroAssetIDs.sort());
        });

        test("Projects with assets", async () => {
            const results = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ 
                    $lookup: {
                        from: "projectAssets",
                        localField: "_id",
                        foreignField: "projectID",
                        as: "assets"
                    }
                }]
            }, userZeroAccessPayload) as (Project & { assets: ProjectAsset[] })[];

            const projects = projectObjects.filter(project => project.access.owners.includes(userZero._id) || project.access.contributors.includes(userZero._id) || project.access.readers.includes(userZero._id));

            const projectAssetsCountPerProjectAsOwner = Object.fromEntries(projects.filter(project => project.access.owners.includes(userZero._id)).map(project => {
                const projectAssets = projectAssetObjects.filter(asset => asset.projectID === project._id);
                return [ project._id, projectAssets.length ];
            }));

            expect(results).toHaveLength(projects.length);

            results.forEach(result => {
                const calculatedCount = projectAssetsCountPerProjectAsOwner[result._id] ?? 0;

                if (result.access.owners.includes(userZero._id)) {
                    const
                        projectAssets = projectAssetObjects.filter(asset => asset.projectID === result._id),
                        projectAssetIDs = projectAssets.map(asset => asset._id);

                    expect(result.assets).toHaveLength(calculatedCount);
                    expect(result.assets.map(asset => asset._id).sort()).toEqual(projectAssetIDs.sort());
                } else {
                    expect(result.assets).toHaveLength(calculatedCount);
                }
            });
        });
    });
});