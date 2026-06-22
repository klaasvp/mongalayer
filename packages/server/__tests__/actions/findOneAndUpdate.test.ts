import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectAssetObjects, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessValidatorError, defineUpdateAccessValidator } from "#src/access.js";
import { getRandomProject, Project, projectAssetUnfinishedStatus, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { FindOneAndUpdatePayload, FindOneAndUpdateReturnType, Operation, UpdateManyPayload, UpdateManyReturnType, UpdateOnePayload, UpdateOneReturnType } from "#src/client.js";

const 
    projectZero: Project = projectObjects[0],
    projectOne: Project = projectObjects[1],
    projectRandom: Project = projectObjects[Math.floor(Math.random() * projectObjects.length)], 
    userZero: User = userObjects[0];

const testSimpleFindOneAndUpdate = async (
    input: FindOneAndUpdatePayload<Project>,
    access: AccessConfig<Document>,
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<FindOneAndUpdateReturnType<Project>> => {
    const collections: MongalayerCollections = {
        projectsCUD: {
            schema: projectSchema,
            access,
        },
    };

    const mongalayer = await getMongaLayerForCollections(collections, {
        debugging: true,
        accessDefaults,
    });

    return (await mongalayer.executeRaw({
        database: dbName,
        collection: "projectsCUD" as MongalayerCollectionType<Project>,
        operation: "findOneAndUpdate",
    }, input, { user: { id: userID } }));
};

describe("Access - FindOneAndUpdate - Defaults & One", () => {
    const newDescription = "Updated description";

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("No roles, default = undefined", async () => {
        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }],
        }));
    });

    test("No roles, default (update & read) = true", async () => {
        const result = await testSimpleFindOneAndUpdate(
            { filter: { _id: projectZero._id }, update: { $set: { description: newDescription } } },
            [], { document: AccessPermissions.ReadWrite }
        );

        expect(result).toStrictEqual(projectZero);
    });

    test("No roles, default (update) = false", async () => {
        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Update })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }]
        }));
    });

    test("No roles, default (read) = false", async () => {
        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Read })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) read access for document" }] }]
        }));
    });

    test("FindOne & Update", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $inc: { version: 1 }, $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual(projectZero);
    });

    test("FindOne & Update - No match", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: "non-existing-id" }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toBe(null);
    });
    
    test("FindOne & Update - Upsert = true (with ReadWrite)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        upsertUpdate.type = "custom";

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: upsertProjectID }, 
            update: {
                $set: upsertUpdate,
                $inc: { version: 1 },
                $unset: { updatedAt: "" }
            },
            options: { upsert: true }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual(null); // The document didn't exists before & returnDocument is false by default (so null is returned)
    });
    
    test("FindOne & Update - Upsert = true (with ReadWrite & returnDocument=after)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        upsertUpdate.type = "custom";

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: upsertProjectID }, 
            update: {
                $set: upsertUpdate,
                $inc: { version: 1 },
                $unset: { updatedAt: "" }
            },
            options: { upsert: true, returnDocument: "after" }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual({ ...upsertUpdate, version: 1, updatedAt: null, _id: upsertProjectID });
    });
    
    test("FindOne & Update - Upsert = true (with ReadWrite & missing field)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: upsertProjectID }, 
            update: { 
                $set: upsertUpdate
            },
            options: { upsert: true }
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([
                { expected: "date", code: "invalid_type", path: [0, "updatedAt"], message: "Invalid input: expected date, received undefined" },
                { expected: "number", code: "invalid_type", path: [0, "version"], message: "Invalid input: expected number, received undefined" },
            ], null, 2),
            name: "ZodError"
        }));
    });
    
    test("FindOne & Update - Upsert = true (without Create)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: upsertProjectID }, 
            update: { 
                $set: upsertUpdate,
                $inc: { version: 1 },
                $unset: { updatedAt: "" }
            },
            options: { upsert: true }
        }, [], { document: AccessPermissions.ReadUpdate })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: "No (default) create access for document" }] }]
        }));
    });

    test("FindOne & Update - dot notation", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2 
            } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual(projectZero);
    });

    test("FindOne & Update - dot notation - wrong types", async () => {
        const update = { 
            "data.location.street": null, 
            "data.location.city": 1,
            version: 2 
        };

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - testing wrong types for dot notation updates
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["data", "location", "city"], message: "Invalid input: expected string, received number" },
                { expected: "string", code: "invalid_type", path: ["data", "location", "street"], message: "Invalid input: expected string, received null" },
            ], null, 2),
            name: "ZodError"
        }));
    });

    test("FindOne & Update - dot notation - invalid property", async () => {
        const update = { 
            "data.unknown": "test",
            "unknown": 123,
        };

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ code: "unrecognized_keys", keys: ["unknown"], path: [], message: `Unrecognized key: "unknown"` }], null, 2),
            name: "ZodError"
        }));
    });

    test("FindOne & Update - dot notation - unset", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $unset: { 
                "data.location.street": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite });
        
        expect(result).toStrictEqual(projectZero);

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $unset: { 
                "config.secret": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: `Field "config.secret" in $unset cannot be removed because it is not optional in the document schema`,
        }));
    });

    test("FindOne & Update - returnDocument: before", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2 
            } },
            options: { returnDocument: "before" }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual(projectZero);
    });

    test("FindOne & Update - returnDocument: after", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2 
            } },
            options: { returnDocument: "after" }
        }, [], { document: AccessPermissions.ReadWrite });

        const newDocument = structuredClone(projectZero);
        newDocument.data.location!.street = "new street";
        newDocument.data.location!.city = "new city";
        newDocument.version = 2;

        expect(result).toStrictEqual(newDocument);
    });

    test("FindOne & Update - with projection", async () => {
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2 
            } },
            options: { projection: { _id: 1, type: 1, name: 1, description: 1 } }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toStrictEqual({
            _id: projectZero._id,
            type: projectZero.type,
            name: projectZero.name,
            description: projectZero.description,
        });
    });

    test("FindOne & Update - dot notation - positional $ operator - scalar", async () => {
        const latestAssetID = projectZero.latestAssets[0], newLatestAssetID = projectAssetObjects.find(pa => !projectZero.latestAssets.includes(pa._id))!._id;

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id, "latestAssets": latestAssetID }, 
            update: { $set: { "latestAssets.$": newLatestAssetID } },
            options: { returnDocument: "after" }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toEqual(expect.objectContaining({
            _id: projectZero._id,
            latestAssets: expect.arrayContaining([ newLatestAssetID ])
        }));
    });

    test("FindOne & Update - dot notation - positional $ operator - nested", async () => {
        const unfinishedAssetID = projectZero.unfinishedAssets[0].id, newStatus = projectAssetUnfinishedStatus.filter(status => status !== projectZero.unfinishedAssets[0].status)[0];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id, "unfinishedAssets.id": unfinishedAssetID }, 
            update: { $set: { "unfinishedAssets.$.status": newStatus } },
            options: { returnDocument: "after" }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result).toEqual(expect.objectContaining({
            _id: projectZero._id,
            unfinishedAssets: expect.arrayContaining([expect.objectContaining({
                id: unfinishedAssetID,
                status: newStatus
            })])
        }));
    });
});

describe("Access - Update permissions", () => {
    const accessConfig: AccessConfig<Document> = [{
        role: "owner",
        filter: { "access.owners": { $in: ["%%user.id"] } },
        document: AccessPermissions.ReadWrite,
    }, {
        role: "contributor",
        filter: { "access.contributors": { $in: ["%%user.id"] } },
        document: AccessPermissions.Read,
    }, {
        role: "reader",
        filter: { "access.readers": { $in: ["%%user.id"] } }
    }];

    const newDescription = "Updated by role";

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Find & Update document as owner (one)", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result).toStrictEqual(project);
    });

    test("Find & Update document as contributor (one)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Find & Update document as reader (one)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Find & Update document as unknown (one)", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result).toBe(null);       
    });
});

describe("Access - Read permissions", () => {
    const accessConfig: AccessConfig<Document> = [{
        role: "owner",
        filter: { "access.owners": { $in: ["%%user.id"] } },
        document: AccessPermissions.ReadWrite,
    }, {
        role: "contributor",
        filter: { "access.contributors": { $in: ["%%user.id"] } },
        document: AccessPermissions.Update,
    }, {
        role: "reader",
        filter: { "access.readers": { $in: ["%%user.id"] } }
    }];

    const newDescription = "Updated by role";

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Find & Update document as owner (one)", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result).toStrictEqual(project);
    });

    test("Find & Update document as contributor (one)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result).toStrictEqual({ _id: project._id }); // Only _id is returned because no read access
    });

    test("Find & Update document as reader (one)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });
});

describe("Access - Find & Update field permissions", () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Find & Update document with document (update) = false & field = undefined", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Update,
        }];

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) },
            ]
        }));
    });

    test("Find & Update document with document (read) = false & field = undefined", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Read,
        }];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {});

        expect(result).toStrictEqual({ _id: projectZero._id }); // Only _id is returned because no read access
    });

    test("Find & Update document with document = true & field = false", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                name: AccessPermissions.Update,
                description: AccessPermissions.Read,
                type: AccessPermissions.ReadWrite,
                version: AccessPermissions.ReadUpdate,
            },
            document: AccessPermissions.ReadWrite,
        }];

        await expect(testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }])}]
        }));

        const resultN = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { name: "Renamed" } } 
        }, accessConfig as AccessConfig<Document>, {});

        const { name, type, version, ...projectZeroWithoutName } = projectZero;

        expect(resultN).toStrictEqual({ ...projectZeroWithoutName, type, version }); // Name is excluded in the return because no read access

        const resultT = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { type: "custom" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultT).toStrictEqual({ ...projectZeroWithoutName, type, version });

        const resultV = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultV).toStrictEqual({ ...projectZeroWithoutName, type: "custom", version });
    });

    test("Find & Update document with document = undefined & field read vs update", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                name: AccessPermissions.Update,
                description: AccessPermissions.Read
            }
        }];

        const result = await testSimpleFindOneAndUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { name: "Renamed" } } 
        }, accessConfig as AccessConfig<Document>, { document: AccessPermissions.None });

        expect(result).toStrictEqual({ _id: projectZero._id, description: projectZero.description }); // Only _id & description are returned because no read access for name or default read
    });
});