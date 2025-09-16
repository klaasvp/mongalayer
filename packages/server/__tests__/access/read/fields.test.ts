import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { dbName, getMongaLayerForCollections, projectObjects, userObjects } from "#test/lib/database";
import { AccessFieldPermissions } from "#src/access.js";
import { JwtPayload } from "jsonwebtoken";
import { Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";

describe('Access - Read - fields', () => {
    const userZero: User = userObjects[0], userKeys = Object.keys(userSchema.shape);
    describe('Access empty', () => {
        let mongalayer: Mongalayer;

        beforeAll(async () => {
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: []
                }
            }
        
            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("No filters", async () => {
            const result = await mongalayer.executeRaw({
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
            const result = await mongalayer.executeRaw({
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
        let mongalayer: Mongalayer;

        beforeAll(async () => {
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: []
                }
            }
        
            mongalayer = await getMongaLayerForCollections(collections, { 
                debugging: true, 
                accessDefaults: {
                    fields: AccessFieldPermissions.None
                }
            });
        });

        test("No projection", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id } }, {});

            expect(result).toStrictEqual({ _id: userZero._id });
        });

        test("Only _id", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id } }, { projection: { _id: 1 } });

            expect(result).toStrictEqual({ _id: userZero._id });
        });

        test("Hide _id", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 0 } } }, {  });

            expect(result).toStrictEqual({ });
        });

        test("Show _id, hide name", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 1, name: 0 } }}, {  });

            expect(result).toStrictEqual({ _id: userZero._id });
        });

        test("Hide _id, show name", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 0, name: 1 } } }, {  });

            expect(result).toStrictEqual({ });
        });
    });

    describe('Access fields default - Read', () => {
        let mongalayer: Mongalayer;

        beforeAll(async () => {
            const collections: MongalayerCollections = {
                users: {
                    schema: userSchema,
                    access: []
                }
            }
        
            mongalayer = await getMongaLayerForCollections(collections, { 
                debugging: true, 
                accessDefaults: {
                    fields: AccessFieldPermissions.Read
                }
            });
        });

        test("No projection", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id } }, {});

            expect(result).toStrictEqual(userZero);
        });

        test("Only _id", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 1 } } }, {  });

            expect(result).toStrictEqual({ _id: userZero._id });
        });

        test("Hide _id", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 0 } } }, {  });

            const { _id, ...otherProps } = userZero;

            expect(result).toStrictEqual(otherProps);
        });

        test("Show _id, hide name", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 1, name: 0 } } }, {});

            const { name, ...otherProps } = userZero;

            expect(result).toStrictEqual(otherProps);
        });

        test("Hide _id, show name", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "users" as MongalayerCollectionType<User>,
                operation: "findOne"
            }, { filter: { _id: userZero._id }, options: { projection: { _id: 0, name: 1 } } }, {  });

            expect(result).toStrictEqual({ name: userZero.name });
        });
    });

    describe('Access user', () => {
        let mongalayer: Mongalayer;

        beforeAll(async () => {    
            const userCollection: MongalayerCollection<User> = {
                schema: userSchema,
                access: [{
                    role: "self",
                    filter: {
                        _id: "%%user.sub"
                    }
                }, {
                    role: "otherAsAdmin",
                    filter: {
                        $$in: ["admin", "%%user.roles"]
                    },
                    fields: { email: AccessFieldPermissions.None },
                    fieldsDefault: AccessFieldPermissions.Read
                }, {
                    role: "other",
                    filter: {},
                    fields: { name: AccessFieldPermissions.Read },
                    fieldsDefault: AccessFieldPermissions.None
                }]
            };

            const collections: MongalayerCollections = {
                users: userCollection
            }
        
            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        describe("as user", () => {
            let userZeroAccessPayload: JwtPayload

            beforeAll(() => {
                userZeroAccessPayload = { user: { sub: userZero._id, roles: ["user"] } };
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

            test("find - self & others", async () => {
                const result = await mongalayer.executeRaw({
                    database: dbName,
                    collection: "users" as MongalayerCollectionType<User>,
                    operation: "find"
                }, {
                    filter: {}
                }, userZeroAccessPayload);

                expect(result.length).toBe(userObjects.length);
                
                result.forEach(user => {
                    if (user._id === userZero._id) expect(user).toStrictEqual(userZero);
                    else {
                        expect(user).toHaveProperty("_id");
                        expect(user).toHaveProperty("name");
                        expect(Object.keys(user).length).toBe(2);
                    }
                })
            });

            test("aggregate - self & others", async () => {
                const result = await mongalayer.executeRaw({
                    database: dbName,
                    collection: "users" as MongalayerCollectionType<User>,
                    operation: "aggregate"
                }, {
                    pipeline: [{ $match: {} }]
                }, userZeroAccessPayload);

                expect(result.length).toBe(userObjects.length);
                
                result.forEach(user => {
                    if (user._id === userZero._id) expect(user).toStrictEqual(userZero);
                    else {
                        expect(user).toHaveProperty("_id");
                        expect(user).toHaveProperty("name");
                        expect(Object.keys(user).length).toBe(2);
                    }
                })
            });
        });

        describe("as admin", () => {
            let userZeroAccessPayload: JwtPayload

            beforeAll(() => {
                userZeroAccessPayload = { user: { sub: userZero._id, roles: ["user", "admin"] } };
            });

            test("find - self & others as admin", async () => {
                const result = await mongalayer.executeRaw({
                    database: dbName,
                    collection: "users" as MongalayerCollectionType<User>,
                    operation: "find"
                }, {
                    filter: {}
                }, userZeroAccessPayload);

                expect(result.length).toBe(userObjects.length);

                const userKeys = Object.keys(userSchema.shape);
                
                result.forEach(user => {
                    if (user._id === userZero._id) expect(user).toStrictEqual(userZero);
                    else {
                        expect(user).not.toHaveProperty("email");
                        expect(Object.keys(user).length).toBe(userKeys.length - 1);
                    }
                })
            });

            test("aggregate - self & others as admin", async () => {
                const result = await mongalayer.executeRaw({
                    database: dbName,
                    collection: "users" as MongalayerCollectionType<User>,
                    operation: "aggregate"
                }, {
                    pipeline: [{ $match: {} }]
                }, userZeroAccessPayload);

                expect(result.length).toBe(userObjects.length);

                const userKeys = Object.keys(userSchema.shape);
                
                result.forEach(user => {
                    if (user._id === userZero._id) expect(user).toStrictEqual(userZero);
                    else {
                        expect(user).not.toHaveProperty("email");
                        expect(Object.keys(user).length).toBe(userKeys.length - 1);
                    }
                })
            });
        });
    });

    describe('Access project', () => {
        let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload;

        const projects = {
            asOwner: [] as Project[],
            asOwnerMap: {} as Record<string, Project>,
            asContributor: [] as Project[],
            asContributorMap: {} as Record<string, Project>,
            asReader: [] as Project[],
            asReaderMap: {} as Record<string, Project>
        };

        beforeAll(async () => {
            const projectCollection: MongalayerCollection<Project> = {
                schema: projectSchema,
                access: [{
                    role: "owner",
                    filter: {
                        "access.owners": {$in: ["%%user.sub"]}
                    }
                }, {
                    role: "contributor",
                    filter: {
                        "access.contributors": {$in: ["%%user.sub"]}
                    },
                    fields: {
                        config: AccessFieldPermissions.None
                    },
                    fieldsDefault: AccessFieldPermissions.Read
                }, {
                    role: "reader",
                    filter: {
                        "access.readers": {$in: ["%%user.sub"]}
                    },
                    fields: {
                        name: AccessFieldPermissions.Read,
                        description: AccessFieldPermissions.Read,
                        data: AccessFieldPermissions.Read
                    },
                    fieldsDefault: AccessFieldPermissions.None
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

            projects.asOwner = projectObjects.filter(project => project.access.owners.includes(userZero._id))!;
            projects.asOwnerMap = projects.asOwner.reduce((acc, project) => ({ ...acc, [project._id]: project }), {});
            projects.asContributor = projectObjects.filter(project => !project.access.owners.includes(userZero._id) && project.access.contributors.includes(userZero._id))!
            projects.asContributorMap = projects.asContributor.reduce((acc, project) => ({ ...acc, [project._id]: project }), {});
            projects.asReader = projectObjects.filter(project => !project.access.owners.includes(userZero._id) && !project.access.contributors.includes(userZero._id) && project.access.readers.includes(userZero._id))!
            projects.asReaderMap = projects.asReader.reduce((acc, project) => ({ ...acc, [project._id]: project }), {});

            mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
        });

        test("find - projects as owner, contributor and reader", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "find"
            }, {
                filter: { }
            }, userZeroAccessPayload);

            expect(result.length).toBe(projects.asOwner.length + projects.asContributor.length + projects.asReader.length);

            const projectKeys = Object.keys(projectSchema.shape);

            result.forEach(project => {
                const projectID = project._id!;

                if (projects.asOwnerMap[projectID]) expect(project).toEqual(projects.asOwnerMap[projectID]);
                else if (projects.asContributorMap[projectID]) {
                    expect(project).not.toHaveProperty("config");

                    expect(Object.keys(project).length).toBe(projectKeys.length - 1);
                } else if (projects.asReaderMap[projectID]) {
                    expect(project).toHaveProperty("name");
                    expect(project).toHaveProperty("description");
                    expect(project).toHaveProperty("data");

                    expect(Object.keys(project).length).toBe(4);
                }
            });
        });

        test("aggregate - projects as owner, contributor and reader", async () => {
            const result = await mongalayer.executeRaw({
                database: dbName,
                collection: "projects" as MongalayerCollectionType<Project>,
                operation: "aggregate"
            }, {
                pipeline: [{ $match: {} }]
            }, userZeroAccessPayload);

            expect(result.length).toBe(projects.asOwner.length + projects.asContributor.length + projects.asReader.length);

            const projectKeys = Object.keys(projectSchema.shape);

            result.forEach(project => {
                const projectID = project._id!;

                if (projects.asOwnerMap[projectID]) expect(project).toEqual(projects.asOwnerMap[projectID]);
                else if (projects.asContributorMap[projectID]) {
                    expect(project).not.toHaveProperty("config");

                    expect(Object.keys(project).length).toBe(projectKeys.length - 1);
                } else if (projects.asReaderMap[projectID]) {
                    expect(project).toHaveProperty("name");
                    expect(project).toHaveProperty("description");
                    expect(project).toHaveProperty("data");

                    expect(Object.keys(project).length).toBe(4);
                }
            });
        });
    });
});