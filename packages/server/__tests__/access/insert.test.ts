import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessValidatorError } from "#src/access.js";
import { getRandomProject, Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document, InsertManyResult, InsertOneResult } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { Operation } from "#src/client.js";
import { getRandomProjectAsset, ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";

const projectZero: Project = projectObjects[0], userZero: User = userObjects[0];

type InsertOperation = Extract<Operation, "insertOne" | "insertMany">;

const testSimpleInsert = async <
    TOperation extends InsertOperation,
    TResult extends TOperation extends "insertOne" ? InsertOneResult : InsertManyResult
> (
    operation: TOperation, 
    input: TOperation extends "insertOne" ? { document: Document } : { documents: Document[] }, 
    access: AccessConfig<Document>, 
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<TResult> => {
    const collections: MongalayerCollections = {
        projectsCUD: {
            schema: projectSchema,
            access
        }
    };

    const mongalayer = await getMongaLayerForCollections(collections, { debugging: true, accessDefaults });

    return await mongalayer.executeRaw({
        database: dbName,
        collection: "projectsCUD" as MongalayerCollectionType<Project>,
        operation
    }, input, {user: {id: userID}}) as TResult;
}

const testSimpleInsertAssets = async <
    TOperation extends InsertOperation,
    TResult extends TOperation extends "insertOne" ? InsertOneResult : InsertManyResult
> (
    operation: TOperation, 
    input: TOperation extends "insertOne" ? { document: Document } : { documents: Document[] }, 
    access: AccessConfig<Document>, 
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<TResult> => {
    const collections: MongalayerCollections = {
        projectAssetsCUD: {
            schema: projectAssetSchema,
            access
        }
    };

    const mongalayer = await getMongaLayerForCollections(collections, { debugging: true, accessDefaults });

    return await mongalayer.executeRaw({
        database: dbName,
        collection: "projectAssetsCUD" as MongalayerCollectionType<ProjectAsset>,
        operation
    }, input, {user: {id: userID}}) as TResult;
}

// InsertOne uses InsertMany behind the scenes, so the result of both should be the same
describe('Access - Insert - One vs Many', () => {
    const newProject = getRandomProject(userObjects);

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("No roles, default = undefined", async () => {
        await expect(testSimpleInsert("insertOne", { document: newProject }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: "No (default) create access for document" }] }]
        }));
    });

    test("No roles, default = true", async () => {
        const result = await testSimpleInsert("insertOne", { document: newProject }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("No roles, default = false", async () => {
        await expect(testSimpleInsert("insertOne", { document: newProject }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Create })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: "No (default) create access for document" }] }]
        }));
    });

    test("Insert One", async () => {
        const result = await testSimpleInsert("insertOne", { document: newProject }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("Insert Many", async () => {
        const result = await testSimpleInsert("insertMany", { documents: [newProject] }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(Object.keys(result.insertedIds)).toHaveLength(1);
        expect(result.insertedIds[0]).toBe(newProject._id);
    });

    test("Insert One - Duplicate", async () => {
        await expect(testSimpleInsert("insertOne", { document: projectZero }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(`E11000 duplicate key error collection: mongalayer.projectsCUD index: _id_ dup key: { _id: "${projectZero._id}" }`);
    });

    test("Insert Many - Duplicate", async () => {
        await expect(testSimpleInsert("insertMany", { documents: [projectZero] }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(`E11000 duplicate key error collection: mongalayer.projectsCUD index: _id_ dup key: { _id: "${projectZero._id}" }`);
    });

    test("Insert One - Invalid doc", async () => {
        const invalidProject = getRandomProject(userObjects);
        invalidProject.description = 123 as unknown as string;

        await expect(testSimpleInsert("insertOne", { document: invalidProject }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ expected: "string", code: "invalid_type", path: [0, "description"], message: "Invalid input: expected string, received number" }], null, 2),
            name: "ZodError"
        }));
    });

    test("Insert One - Unknown property", async () => {
        const invalidProject = getRandomProject(userObjects);
        // @ts-ignore -> invalid
        invalidProject.unknown = 123;
        // @ts-ignore -> valid
        invalidProject.data.unknown = "test";

        await expect(testSimpleInsert("insertOne", { document: invalidProject }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ code: "unrecognized_keys", keys: ["unknown"], path: [0], message: `Unrecognized key: "unknown"` }], null, 2),
            name: "ZodError"
        }));
    });
});

describe('Access - Insert validate presents', async () => {
    const newProject = getRandomProject(userObjects), database = await getMongoDBDatabase();

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Success", async () => {
        await testSimpleInsert("insertOne", { document: newProject }, [], { document: AccessPermissions.ReadWrite });

        const result = await database.collection<Project>("projectsCUD").findOne({ _id: newProject._id });

        expect(result).toStrictEqual(newProject);
    });

    test("Failure", async () => {
        await expect(testSimpleInsert("insertOne", { document: newProject }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: "No (default) create access for document" }] }]
        }));

        const result = await database.collection<Project>("projectsCUD").findOne({ _id: newProject._id });

        expect(result).toBe(null);
    });
});

describe('Access - Create permissions', () => {
    describe('Owner (create = true), contributor (create = false), reader (create = undefined)', () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "owner",
            filter: {
                "access.owners": {"$in": ["%%user.id"]}
            },
            document: AccessPermissions.ReadWrite
        }, {
            role: "contributor",
            filter: {
                "access.contributors": {"$in": ["%%user.id"]}
            },
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Create
        }, {
            role: "reader",
            filter: {
                "access.readers": {"$in": ["%%user.id"]}
            }
        }];

        const newUser = getRandomUser();

        beforeEach(async () => {
            await resetCUDCollections();
        });

        test("Create document as owner", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.owners.push(newUser._id);
            
            const result = await testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id);

            expect(result.acknowledged).toBe(true);
            expect(result.insertedId).toBe(newProject._id);
        });

        test("Create document as contributor", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.contributors.push(newUser._id);

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
            }));
        });

        test("Create document as reader", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.readers.push(newUser._id);      

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
            }));
        });

        test("Create document as unknown", async () => {
            const newProject = getRandomProject(userObjects);

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No access role found for document` }] }]
            }));
        });
    });

    describe('Alternative collection - Owner (create = true), contributor (create = false), reader (create = undefined)', async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "owner",
            filter: {
                uploaderID: "%%user.id"
            },
            collection: {
                target: "projectsCUD",
                targetFilter: {
                    "access.owners": {"$in": ["%%user.id"]}
                },
                targetField: "_id",
                localField: "projectID"
            },
            document: AccessPermissions.ReadWrite
        }, {
            role: "contributor",
            filter: {},
            collection: {
                target: "projectsCUD",
                targetFilter: {
                    "access.contributors": {"$in": ["%%user.id"]}
                },
                targetField: "_id",
                localField: "projectID"
            },
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Create
        }, {
            role: "reader",
            filter: {},
            collection: {
                target: "projectsCUD",
                targetFilter: {
                    "access.readers": {"$in": ["%%user.id"]}
                },
                targetField: "_id",
                localField: "projectID"
            },
        }];

        const newUser = getRandomUser();

        const database = await getMongoDBDatabase();

        beforeEach(async () => {
            await resetCUDCollections();
        });

        test("Create document as owner, as uploader", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.owners = [newUser._id];
            const newProjectAsset = getRandomProjectAsset([newProject]);
            
            await database.collection<Project>("projectsCUD").insertOne(newProject);

            const result = await testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id);

            expect(result.acknowledged).toBe(true);
            expect(result.insertedId).toBe(newProjectAsset._id);
        });

        test("Create document as owner, not uploader", async () => {
            const newProject = getRandomProject(userObjects);
            const newProjectAsset = getRandomProjectAsset([newProject]);

            // Uploader is different user, so assignment needs to happen after the project asset is created
            newProject.access.owners.push(newUser._id);
            
            await database.collection<Project>("projectsCUD").insertOne(newProject);

            await expect(testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No access role found for document` }] }]
            }));
        });

        test("Create document as contributor, as uploader", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.owners = [newUser._id];
            newProject.access.contributors.push(newUser._id);
            const newProjectAsset = getRandomProjectAsset([newProject]);
            
            newProject.access.owners = []; // Remove owner access to be only contributor but as uploader

            await database.collection<Project>("projectsCUD").insertOne(newProject);

            await expect(testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
            }));
        });

        test("Create document as contributor", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.contributors.push(newUser._id);
            const newProjectAsset = getRandomProjectAsset([newProject]);
            
            await database.collection<Project>("projectsCUD").insertOne(newProject);

            await expect(testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
            }));
        });

        test("Create document as reader", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.readers.push(newUser._id);
            const newProjectAsset = getRandomProjectAsset([newProject]);   
            
            await database.collection<Project>("projectsCUD").insertOne(newProject);

            await expect(testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
            }));
        });

        test("Create document as unknown", async () => {
            const newProject = getRandomProject(userObjects);
            const newProjectAsset = getRandomProjectAsset([newProject]);
            
            await database.collection<Project>("projectsCUD").insertOne(newProject);

            await expect(testSimpleInsertAssets("insertOne", { document: newProjectAsset }, accessConfig, {}, newUser._id)).rejects.toThrowError(expect.objectContaining({
                message: `Unauthorized documents found`,
                unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No access role found for document` }] }]
            }));
        });
    });
});

describe('Access - Create field permissions', () => {
    const newUser = getRandomUser();

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Create document with document = false & field = undefined", async () => {
        const newProject = getRandomProject(userObjects);

        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Create
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "document", issue: `No create access for document` }]) }]
        }));
    });

    test("Create document with document = true & field = false", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                name: AccessPermissions.Create,
                description: AccessPermissions.Read,
                type: AccessPermissions.ReadWrite
            },
            document: AccessPermissions.ReadWrite
        }];

        const newProject = getRandomProject(userObjects);

        const withDescription = structuredClone(newProject);

        await expect(testSimpleInsert("insertOne", { document: withDescription }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have create access for field "description".` }]) }]
        }));

        const withoutDescription = structuredClone(newProject);
        delete withoutDescription.description;

        const result = await testSimpleInsert("insertOne", { document: withoutDescription }, accessConfig as AccessConfig<Document>, {});

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });
});

describe('Access - Create validator', () => {
    const newProject = getRandomProject(userObjects);

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Validator arguments", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {
                    expect(context.accessData).toStrictEqual({user: {id: userZero._id}});
                    expect(context.action).toBe("create");
                    expect(context.collection).toBe("projectsCUD");
                    expect(context.database).toBe(dbName);
                    expect(doc).toStrictEqual(newProject);
                }
            }
        }];

        const result = await testSimpleInsert("insertOne", { document: newProject }, accessConfig, {});

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("Validator should not be called without create permission", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.Read,
            validators: {
                create: async (context, doc) => {
                    expect.unreachable();
                }
            }
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "document", issue: `No create access for document` }]) }]
        }));
    });

    test("Validator should not be called without field create permission", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            fields: {
                description: AccessPermissions.Read
            },
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {
                    expect.unreachable();
                }
            }
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have create access for field "description".` }]) }]
        }));
    });

    test("Validator returns nothing", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {}
            }
        }];

        const result = await testSimpleInsert("insertOne", { document: newProject }, accessConfig, {});

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("Validator returns true", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => true
            }
        }];

        const result = await testSimpleInsert("insertOne", { document: newProject }, accessConfig, {});

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("Validator return false", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => false
            }
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "document", issue: `Document failed custom validation` }]) }]
        }));
    });

    test("Validator throws AccessValidatorError", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {
                    throw new AccessValidatorError("AccessValidatorError test")
                }
            }
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) }]
        }));
    });

    test("Validator throws multiple AccessValidatorError", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {
                    throw new AccessValidatorError("AccessValidatorError test")
                }
            }
        }];

        const newProjectB = getRandomProject(userObjects);

        await expect(testSimpleInsert("insertMany", { documents: [newProject, newProjectB] }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) },
                { index: 1, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) }
            ]
        }));
    });

    test("Validator throws error/exception (not AccessValidatorError)", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                create: async (context, doc) => {
                    throw "validator exception test"
                }
            }
        }];

        await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {})).rejects.toThrowError(`validator exception test`);
    });
});