import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions } from "#src/access.js";
import { getRandomProject, Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { Operation, UpdateOnePayload, UpdateOneReturnType } from "#src/client.js";
import { version } from "zod/v4/core";

const projectZero: Project = projectObjects[0], userZero: User = userObjects[0];

const testSimpleUpdate = async (
    input: UpdateOnePayload<Project>,
    access: AccessConfig<Document>,
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<UpdateOneReturnType<Project>> => {
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
        operation: "updateOne",
    }, input, { user: { id: userID } })) as UpdateOneReturnType<Project>;
};

describe("Access - Update - Defaults & One", () => {
    const newDescription = "Updated description";

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("No roles, default = undefined", async () => {
        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }],
        }));
    });

    test("No roles, default = true", async () => {
        const result = await testSimpleUpdate(
            { filter: { _id: projectZero._id }, update: { $set: { description: newDescription } } },
            [], { document: AccessPermissions.ReadWrite }
        );

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("No roles, default = false", async () => {
        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Update })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }]
        }));
    });

    test("Update One", async () => {
        const result = await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $inc: { version: 1 }, $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update One - No match", async () => {
        const result = await testSimpleUpdate({ 
            filter: { _id: "non-existing-id" }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
    });
    
    test("Update One - Upsert = true (with ReadWrite)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        const result = await testSimpleUpdate({ 
            filter: { _id: upsertProjectID }, 
            update: {
                $set: upsertUpdate,
                $inc: { version: 1 },
                $unset: { updatedAt: "" }
            },
            options: { upsert: true }
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
        expect(result.upsertedId).toEqual(upsertProjectID);
        expect(result.upsertedCount).toBe(1);
    });
    
    test("Update One - Upsert = true (with ReadWrite & missing field)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        await expect(testSimpleUpdate({ 
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
    
    test("Update One - Upsert = true (without Create)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        await expect(testSimpleUpdate({ 
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

    test("Update One - dot notation", async () => {
        const result = await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2 
            } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update One - dot notation - wrong types", async () => {
        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.location.street": null, 
                "data.location.city": 1,
                version: 2 
            } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["data", "location", "city"], message: "Invalid input: expected string, received number" },
                { expected: "string", code: "invalid_type", path: ["data", "location", "street"], message: "Invalid input: expected string, received null" },
            ], null, 2),
            name: "ZodError"
        }));
    });

    test("Update One - dot notation - invalid property", async () => {
        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { 
                "data.unknown": "test",
                "unknown": 123,
            } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ code: "unrecognized_keys", keys: ["unknown"], path: [], message: `Unrecognized key: "unknown"` }], null, 2),
            name: "ZodError"
        }));
    });
});

describe("Access - Update validate presents", async () => {
    const newDescription = "Updated description";
    const database = await getMongoDBDatabase();

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Success", async () => {
        await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        const result = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });

        expect(result?.description).toBe(newDescription);
    });

    test("Failure", async () => {
        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] },
            ],
        }));

        const result = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });

        expect(result?.description).toBe(projectZero.description);
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

    test("Update document as owner", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];

        const result = await testSimpleUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update document as contributor", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];

        await expect(testSimpleUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "document", issue: `No update access for document` }] },
            ],
        }));
    });

    test("Update document as reader", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];

        await expect(testSimpleUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "document", issue: `No update access for document` }] },
            ],
        }));
    });

    test("Update document as unknown", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdate({ 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);        
    });
});

describe("Access - Update field permissions", () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Update document with document = false & field = undefined", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite ^ AccessPermissions.Update,
        }];

        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "document", issue: `No update access for document` }]) },
            ]
        }));
    });

    test("Update document with document = true & field = false", async () => {
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

        await expect(testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }])}]
        }));

        const resultN = await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { name: "Renamed" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultN.acknowledged).toBe(true);
        expect(resultN.matchedCount).toBe(1);
        expect(resultN.modifiedCount).toBe(1);

        const resultT = await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { type: "premium" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultT.acknowledged).toBe(true);
        expect(resultT.matchedCount).toBe(1);
        expect(resultT.modifiedCount).toBe(1);

        const resultV = await testSimpleUpdate({ 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultV.acknowledged).toBe(true);
        expect(resultV.matchedCount).toBe(1);
        expect(resultV.modifiedCount).toBe(1);
    });
});
