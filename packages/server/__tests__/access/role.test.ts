import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { JwtPayload } from "jsonwebtoken";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects, userObjects } from "#test/lib/database";
import { AccessConfig, AccessFieldPermissions, WithAccessRole } from "#src/access";
import { Db, Document } from "mongodb";
import { ZodObject } from "zod/v4";
import { QueryService } from "#src/query";

describe('Access - Roles', () => {
    let database: Db, userZero = userObjects[0], userOne = userObjects[0];

    beforeAll(async () => {
        database = await getMongoDBDatabase();
    });

    test("User - No access - Role empty", async () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: []
        }

        const accessService = new QueryService({}, collection.access as AccessConfig, collection.schema, AccessFieldPermissions.Read);

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
                    $eq: ["$_id", "%%user.sub"]
                }
            }]
        }

        const accessService = new QueryService({user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, AccessFieldPermissions.Read);

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: { _id: userZero._id } } ];

        if (stages.$role) pipeline.push(stages.$role);

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
                    "$in": ["%%user.sub", "$access.owners"]
                }
            }, {
                role: "contributor",
                filter: {
                    "$in": ["%%user.sub", "$access.contributors"]
                }
            }, {
                role: "reader",
                filter: {
                    "$in": ["%%user.sub", "$access.readers"]
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

        const accessService = new QueryService({user: {sub: userZero._id}}, collection.access as AccessConfig, collection.schema, AccessFieldPermissions.Read);

        const stages = accessService.getStages({});

        const pipeline: Document[] = [ { $match: {} } ];

        if (stages.$role) pipeline.push(stages.$role);
        
        const result = await database.collection("projects").aggregate<WithAccessRole<Project>>(pipeline).toArray();

        expect(result.length).toEqual(projectObjects.length);

        result.forEach(project => {
            expect(project).toHaveProperty("__mongalayer_role");
            expect(project.__mongalayer_role).toBe(projectRoleMapping[project._id]);
        });
    });
});