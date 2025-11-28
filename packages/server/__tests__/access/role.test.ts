import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { JwtPayload } from "jsonwebtoken";
import { dbName, getMongaLayerForCollections, getMongoDBClient, getMongoDBDatabase, projectAssetObjects, projectObjects, userObjects } from "#test/lib/database";
import { AccessAlternativeCollection, AccessConfig, AccessPermissions, WithAccessRole } from "#src/access";
import { Db, Document, MongoClient } from "mongodb";
import { ZodObject } from "zod/v4";
import { QueryAccessService } from "#src/access/query";
import { ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";

describe('Access - Roles', () => {
    let client: MongoClient, database: Db, userZero = userObjects[0], userOne = userObjects[0];

    beforeAll(async () => {
        client = await getMongoDBClient();
        database = client!.db(dbName);
    });

    test("User - No access - Role empty", async () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: []
        }

        const accessService = new QueryAccessService(client, dbName, "user", {}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(stages.$role);

        pipeline.push({ $limit: 1 });
        
        const 
            results = await database.collection("users").aggregate<WithAccessRole<User>>(pipeline).toArray(),
            result = results[0];

        expect(result).not.toHaveProperty("__mongalayer_role");
    });

    test("User - Self access - Role Self", async () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: {
                    _id: "%%user.sub"
                }
            }]
        }

        const accessService = new QueryAccessService(client, dbName, "users", {user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: { _id: userZero._id } } ];

        if (stages.$role) pipeline.push(...stages.$role);

        pipeline.push({ $limit: 1 });
        
        const 
            results = await database.collection("users").aggregate<WithAccessRole<User>>(pipeline).toArray(),
            result = results[0];

        expect(result).toBeDefined();

        if (result) {
            expect(result).toHaveProperty("__mongalayer_role");
            expect(result.__mongalayer_role).toBe("self");
        }
    });

    test("Project - Multiple roles", async () => {
        const collection: MongalayerCollection<Project> = {
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

        const projectRoleMapping = projectObjects.reduce((mapping, project) => {
            if (project.access.owners.includes(userZero._id)) mapping[project._id] = "owner";
            else if (project.access.contributors.includes(userZero._id)) mapping[project._id] = "contributor";
            else if (project.access.readers.includes(userZero._id)) mapping[project._id] = "reader";
            else mapping[project._id] = null;

            return mapping;
        }, {} as Record<string, string | null>);

        const accessService = new QueryAccessService(client, dbName, "projects", {user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(...stages.$role);
        
        const result = await database.collection("projects").aggregate<WithAccessRole<Project>>(pipeline).toArray();

        expect(result.length).toEqual(projectObjects.length);

        result.forEach(project => {
            expect(project).toHaveProperty("__mongalayer_role");
            expect(project.__mongalayer_role).toBe(projectRoleMapping[project._id]);
        });
    });

    test("Project Assets - Roles through alternative collection", async () => {
        const altCollection: Pick<AccessAlternativeCollection<ProjectAsset, Project>, "target" | "targetField" | "localField"> = {
            target: "projects",
            targetField: "_id",
            localField: "projectID"
        };
        
        const collection: MongalayerCollection<ProjectAsset> = {
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
            }, {
                role: "contributor",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.contributors": {"$in": ["%%user.sub"]}
                } }
            }, {
                role: "reader",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.readers": {"$in": ["%%user.sub"]}
                }}
            }]
        };

        const projectRoleMapping = projectAssetObjects.reduce((mapping, projectAsset) => {
            const project = projectObjects.find(p => p._id === projectAsset.projectID)!;

            if (projectAsset.uploaderID === userZero._id) mapping[projectAsset._id] = "creator";
            else if (project.access.owners.includes(userZero._id)) mapping[projectAsset._id] = "owner";
            else if (project.access.contributors.includes(userZero._id)) mapping[projectAsset._id] = "contributor";
            else if (project.access.readers.includes(userZero._id)) mapping[projectAsset._id] = "reader";
            else mapping[projectAsset._id] = null;

            return mapping;
        }, {} as Record<string, string | null>);

        const accessService = new QueryAccessService(client, dbName, "projectAssets", {user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(...stages.$role);

        const result = await database.collection("projectAssets").aggregate<WithAccessRole<ProjectAsset>>(pipeline).toArray();

        expect(result.length).toEqual(Object.entries(projectRoleMapping).filter(([_, role]) => role !== null).length);

        result.forEach(projectAsset => {
            expect(projectAsset).toHaveProperty("__mongalayer_role");
            expect(projectAsset.__mongalayer_role).toBe(projectRoleMapping[projectAsset._id]);
        });
    });

    test("Project Assets - Roles through alternative collection - array", async () => {
        const altCollection: Pick<AccessAlternativeCollection<ProjectAsset, Project>, "target" | "targetField" | "localField"> = {
            target: "projects",
            targetField: "latestAssets",
            localField: "_id"
        };
        
        const collection: MongalayerCollection<ProjectAsset> = {
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
            }, {
                role: "contributor",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.contributors": {"$in": ["%%user.sub"]}
                } }
            }, {
                role: "reader",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.readers": {"$in": ["%%user.sub"]}
                } }
            }]
        };

        const projectRoleMapping = projectAssetObjects.reduce((mapping, projectAsset) => {
            const project = projectObjects.find(p => p.latestAssets.includes(projectAsset._id))!;

            if (project) {
                if (projectAsset.uploaderID === userZero._id) mapping[projectAsset._id] = "creator";
                else if (project.access.owners.includes(userZero._id)) mapping[projectAsset._id] = "owner";
                else if (project.access.contributors.includes(userZero._id)) mapping[projectAsset._id] = "contributor";
                else if (project.access.readers.includes(userZero._id)) mapping[projectAsset._id] = "reader";
                else mapping[projectAsset._id] = null;
            }

            return mapping;
        }, {} as Record<string, string | null>);

        const accessService = new QueryAccessService(client, dbName, "projectAssets", {user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(...stages.$role);
        
        const result = await database.collection("projectAssets").aggregate<WithAccessRole<ProjectAsset>>(pipeline).toArray();

        expect(result.length).toEqual(Object.entries(projectRoleMapping).filter(([_, role]) => role !== null).length);

        result.forEach(projectAsset => {
            expect(projectAsset).toHaveProperty("__mongalayer_role");
            expect(projectAsset.__mongalayer_role).toBe(projectRoleMapping[projectAsset._id]);
        });
    });

    test("Project Assets - Roles through alternative collection - field in embedded array", async () => {
        const altCollection: Pick<AccessAlternativeCollection<ProjectAsset, Project>, "target" | "targetField" | "localField" | "targetFieldArrayPath"> = {
            target: "projects",
            targetField: "id",
            targetFieldArrayPath: "unfinishedAssets",
            localField: "_id"
        };
        
        const collection: MongalayerCollection<ProjectAsset> = {
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
            }, {
                role: "contributor",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.contributors": {"$in": ["%%user.sub"]}
                } }
            }, {
                role: "reader",
                filter: {},
                collection: { ...altCollection, targetFilter: {
                    "access.readers": {"$in": ["%%user.sub"]}
                } }
            }]
        };

        const projectRoleMapping = projectAssetObjects.reduce((mapping, projectAsset) => {
            const project = projectObjects.find(p => p.unfinishedAssets.map(unfinishedAsset => unfinishedAsset.id).includes(projectAsset._id))!;

            if (project) {
                if (projectAsset.uploaderID === userZero._id) mapping[projectAsset._id] = "creator";
                else if (project.access.owners.includes(userZero._id)) mapping[projectAsset._id] = "owner";
                else if (project.access.contributors.includes(userZero._id)) mapping[projectAsset._id] = "contributor";
                else if (project.access.readers.includes(userZero._id)) mapping[projectAsset._id] = "reader";
                else mapping[projectAsset._id] = null;
            }
            
            return mapping;
        }, {} as Record<string, string | null>);

        const accessService = new QueryAccessService(client, dbName, "projectAssets", {user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, { document: AccessPermissions.Read, delete: false });

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(...stages.$role);
        
        const result = await database.collection("projectAssets").aggregate<WithAccessRole<ProjectAsset>>(pipeline).toArray();

        expect(result.length).toEqual(Object.entries(projectRoleMapping).filter(([_, role]) => role !== null).length);

        result.forEach(projectAsset => {
            expect(projectAsset).toHaveProperty("__mongalayer_role");
            expect(projectAsset.__mongalayer_role).toBe(projectRoleMapping[projectAsset._id]);
        });
    });
});