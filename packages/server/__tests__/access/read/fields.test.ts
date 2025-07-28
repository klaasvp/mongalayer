import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollections, MongalayerCollectionType } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { dbName, getMongaLayerForCollections, userObjects } from "#test/lib/database";
import { AccessFieldPermissions } from "#src/access.js";
import { JwtPayload } from "jsonwebtoken";

describe('Access - Read - fields', () => {
    describe('Access empty', () => {
        let mongalayer: Mongalayer, userZero: User, userKeys = Object.keys(userSchema.shape);

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

        test("No filters", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne",
            }, {
                filter: {}
            }, {});

            expect(result).not.toBeNull();

            if (result !== null) {
                expect(Object.keys(result)).toHaveLength(userKeys.length);

                userKeys.forEach(key => {
                    expect(result).toHaveProperty(key);
                });
            }
        });

        test("_id filter", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, {
                filter: {
                    _id: userZero._id
                }
            }, {});

            expect(result).not.toBeNull();

            if (result !== null) {
                expect(Object.keys(result)).toHaveLength(userKeys.length);

                userKeys.forEach(key => {
                    expect(result).toHaveProperty(key);
                });
            }
        });
    });

    describe('Access fields default - None', () => {
        let mongalayer: Mongalayer, userZero: User;

        beforeAll(async () => {
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: []
                }
            }
        
            userZero = userObjects[0];
        
            mongalayer = await getMongaLayerForCollections(collections, { 
                debugging: true, 
                accessFieldsDefault: AccessFieldPermissions.None 
            });
        });

        test("No projection", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id } }, {});

            expect(result).toEqual({ _id: userZero._id });
        });

        test("Hide _id", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 0 } } }, {  });

            expect(result).toEqual({ });
        });
    });

    describe('Access user', () => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload;

        beforeAll(async () => {    
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: [{
                        role: "self",
                        filter: {
                            $eq: ["$_id", "%%user.sub"]
                        }
                    }]
                }
            }
        
            userZero = userObjects[0];
            userZeroAccessPayload = {
                user: {
                    sub: userZero._id
                }
            };

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("findOne - self filter", async () => {
            const result = await mongalayer.execute({
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
    });

    /*describe('Access project - owner & reader', () => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, projectWithoutUserAsOwner: Project, projectWithUserAsOwner: Project;

        beforeAll(async () => {
            const projectCollection: MongalayerCollection<Project> = {
                schema: projectSchema,
                access: [{
                    role: "owner",
                    filter: {
                        "access.owners": {"$in": ["%%user.sub"]}
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
            const result = await mongalayer.execute({
                database: dbName,
                collection: "projects",
                operation: "findOne",
                payload: {
                    filter: {
                        _id: projectWithUserAsOwner._id
                    }
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(projectWithUserAsOwner);
        });

        test("findOne - project not as owner = null", async () => {
            const result = await mongalayer.execute({
                database: dbName,
                collection: "projects",
                operation: "findOne",
                payload: {
                    filter: {
                        _id: projectWithoutUserAsOwner._id
                    }
                }
            }, userZeroAccessPayload);

            expect(result).toStrictEqual(null);
        });
    });*/
});