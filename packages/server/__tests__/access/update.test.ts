import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessValidatorError, defineUpdateAccessValidator } from "#src/access.js";
import { getRandomProject, Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { Operation, UpdateManyPayload, UpdateManyReturnType, UpdateOnePayload, UpdateOneReturnType } from "#src/client.js";

const 
    projectZero: Project = projectObjects[0],
    projectOne: Project = projectObjects[1],
    projectRandom: Project = projectObjects.filter(po => po._id !== projectZero._id && po._id !== projectOne._id)[Math.floor(Math.random() * (projectObjects.length - 2))], 
    userZero: User = userObjects[0];

type UpdateOperation = Extract<Operation, "updateOne" | "updateMany">;

const testSimpleUpdate = async <
    TOperation extends UpdateOperation,
    TResult extends TOperation extends "updateOne" ? UpdateOneReturnType<Project> : UpdateManyReturnType<Project>
> (
    operation: TOperation, 
    input: TOperation extends "updateOne" ? UpdateOnePayload<Project> : UpdateManyPayload<Project>,
    access: AccessConfig<Document>,
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<TResult> => {
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
        operation,
    }, input, { user: { id: userID } })) as TResult;
};

describe("Access - Update - Defaults & One", () => {
    const newDescription = "Updated description";

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("No roles, default = undefined", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }],
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectOne._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
                expect.objectContaining({ id: projectRandom._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
            ]),
        }));
    });

    test("No roles, default = true", async () => {
        const result = await testSimpleUpdate("updateOne", 
            { filter: { _id: projectZero._id }, update: { $set: { description: newDescription } } },
            [], { document: AccessPermissions.ReadWrite }
        );

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(2);
        expect(resultMany.modifiedCount).toBe(2);
    });

    test("No roles, default = false", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Update })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }]
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite ^ AccessPermissions.Update })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectOne._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
                expect.objectContaining({ id: projectRandom._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
            ]),
        }));
    });

    test("Update", async () => {
        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $inc: { version: 1 }, $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(2);
        expect(resultMany.modifiedCount).toBe(1); // Project zero is already updated
    });

    test("Update One - No match", async () => {
        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: "non-existing-id" }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
    });

    test("Update Many - 1 match (out of 2)", async () => {
        const result = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ "non-existing-id", projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });
    
    test("Update One - Upsert = true (with ReadWrite)", async () => {
        const upsertProject = getRandomProject(userObjects);

        const { _id: upsertProjectID, version, updatedAt, ...upsertUpdate } = upsertProject;

        upsertUpdate.type = "custom";

        const result = await testSimpleUpdate("updateOne", { 
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

        await expect(testSimpleUpdate("updateOne", { 
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

        await expect(testSimpleUpdate("updateOne", { 
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

    test("Update - dot notation", async () => {
        const result = await testSimpleUpdate("updateOne", { 
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

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { 
                "data.location.street": "new street", 
                "data.location.city": "new city",
                version: 2
             } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(2);
        expect(resultMany.modifiedCount).toBe(1);
    });

    test("Update One - dot notation - wrong types", async () => {
        const update = { 
            "data.location.street": null, 
            "data.location.city": 1,
            version: 2 
        };

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["data", "location", "city"], message: "Invalid input: expected string, received number" },
                { expected: "string", code: "invalid_type", path: ["data", "location", "street"], message: "Invalid input: expected string, received null" },
            ], null, 2),
            name: "ZodError"
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["data", "location", "city"], message: "Invalid input: expected string, received number" },
                { expected: "string", code: "invalid_type", path: ["data", "location", "street"], message: "Invalid input: expected string, received null" },
            ], null, 2),
            name: "ZodError"
        }));
    });

    test("Update - dot notation - invalid property", async () => {
        const update = { 
            "data.unknown": "test",
            "unknown": 123,
        };

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ code: "unrecognized_keys", keys: ["unknown"], path: [], message: `Unrecognized key: "unknown"` }], null, 2),
            name: "ZodError"
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: update } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: JSON.stringify([{ code: "unrecognized_keys", keys: ["unknown"], path: [], message: `Unrecognized key: "unknown"` }], null, 2),
            name: "ZodError"
        }));
    });

    test("Update One - dot notation - unset", async () => {
        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $unset: { 
                "data.location.street": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite });
        
        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $unset: { 
                "data.location.street": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(2);
        expect(resultMany.modifiedCount).toBe(1);

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $unset: { 
                "config.secret": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: `Field "config.secret" in $unset cannot be removed because it is not optional in the document schema`,
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $unset: { 
                "config.secret": ""
            } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: `Field "config.secret" in $unset cannot be removed because it is not optional in the document schema`,
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
        await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        const result = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });

        expect(result?.description).toBe(newDescription);

        await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], { document: AccessPermissions.ReadWrite });

        const resultMany = await database.collection<Project>("projectsCUD").find({ _id: { $in: [ projectOne._id, projectRandom._id ] } }).toArray();

        resultMany.forEach(r => {
            expect(r.description).toBe(newDescription);
        });
    });

    test("Failure", async () => {
        await expect(testSimpleUpdate("updateOne", { 
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

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: newDescription } } 
        }, [], {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectOne._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
                expect.objectContaining({ id: projectRandom._id, issues: [{ type: "document", issue: "No (default) update access for document" }] }),
            ]),
        }));

        const resultMany = await database.collection<Project>("projectsCUD").find({ _id: { $in: [ projectOne._id, projectRandom._id ] } }).toArray();

        resultMany.forEach(r => {
            const projectDesc = projectObjects.find(p => p._id === r._id)!.description;
            expect(r.description).toBe(projectDesc);
        });
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

    // updateOne
    test("Update document as owner (one)", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update document as contributor (one)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as reader (one)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as unknown (one)", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);        
    });

    // updateMany
    test("Update document as owner (many)", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];

        const result = await testSimpleUpdate("updateMany", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update document as contributor (many)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as reader (many)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: project._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: project._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as unknown (many)", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdate("updateMany", { 
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

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) },
            ]
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectRandom._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) }),
                expect.objectContaining({ id: projectOne._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) }),
            ])
        }));
    });

    test("Update document with document = false & fields", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                name: AccessPermissions.Update,
                description: AccessPermissions.Read,
                type: AccessPermissions.ReadWrite,
                version: AccessPermissions.ReadUpdate,
            },
            document: AccessPermissions.Read,
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }])}]
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectOne._id, projectRandom._id ] } }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectOne._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) }),
                expect.objectContaining({ id: projectRandom._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) })
            ])
        }));

        const resultN = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { name: "Renamed" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultN.acknowledged).toBe(true);
        expect(resultN.matchedCount).toBe(1);
        expect(resultN.modifiedCount).toBe(1);

        const resultNMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { name: "Renamed" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultNMany.acknowledged).toBe(true);
        expect(resultNMany.matchedCount).toBe(2);
        expect(resultNMany.modifiedCount).toBe(1);

        const resultT = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { type: "custom" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultT.acknowledged).toBe(true);
        expect(resultT.matchedCount).toBe(1);
        expect(resultT.modifiedCount).toBe(1);

        const resultTMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { type: "custom" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultTMany.acknowledged).toBe(true);
        expect(resultTMany.matchedCount).toBe(2);
        expect(resultTMany.modifiedCount).toBe(1);

        const resultV = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultV.acknowledged).toBe(true);
        expect(resultV.matchedCount).toBe(1);
        expect(resultV.modifiedCount).toBe(1);

        const resultVMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(resultVMany.acknowledged).toBe(true);
        expect(resultVMany.matchedCount).toBe(2);
        expect(resultVMany.modifiedCount).toBe(1);
    });

    test("Update document with document = undefined & field = R", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                description: AccessPermissions.Read,
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }])}]
        }));
    });

    test("Update document with document = undefined & field = RW", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                description: AccessPermissions.ReadWrite,
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 1 } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "version", issue: `Role "test" does not have update access for field "version".` }])}]
        }));
    });

    test("Update document with document = undefined & field = U", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                description: AccessPermissions.Update,
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });
});

describe('Access - Update validator', () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Validator arguments", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: defineUpdateAccessValidator<Project>()([], async (context, doc) => {
                    expect(context.accessData).toStrictEqual({user: {id: userZero._id}});
                    expect(context.action).toBe("update");
                    expect(context.collection).toBe("projectsCUD");
                    expect(context.database).toBe(dbName);
                    expect(doc).toStrictEqual({
                        _id: projectZero._id,
                        __mongalayer_role: "test"
                    });
                })
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Validator arguments - extra fields", async () => {        
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: defineUpdateAccessValidator<Project>()(
                    [ "type", "version" ], 
                    async (context, doc) => {
                        expect(context.accessData).toStrictEqual({user: {id: userZero._id}});
                        expect(context.action).toBe("update");
                        expect(context.collection).toBe("projectsCUD");
                        expect(context.database).toBe(dbName);
                        expect(doc).toStrictEqual({
                            _id: projectZero._id,
                            __mongalayer_role: "test",
                            type: projectZero.type,
                            version: projectZero.version
                        });
                    }
                )
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig as AccessConfig<Document>, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Validator should not be called without update permission", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.Read,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        expect.unreachable();
                    }
                }
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { version: 10 } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "version", issue: `Role "test" does not have update access for field "version".` }]) }]
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
                update: {
                    validator: async (context, doc) => {
                        expect.unreachable();
                    }
                }
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "description", issue: `Role "test" does not have update access for field "description".` }]) }]
        }));
    });

    test("Validator returns nothing", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {}
                }
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Validator returns true", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => true
                }
            }
        }];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {});

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Validator return false", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => false
                }
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "document", issue: `Document failed custom validation` }]) }]
        }));
    });

    test("Validator throws AccessValidatorError", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        throw new AccessValidatorError("AccessValidatorError test")
                    }
                }
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) }]
        }));
    });

    test("Validator throws multiple AccessValidatorError", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        throw new AccessValidatorError("AccessValidatorError test")
                    }
                }
            }
        }];

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectOne._id ] } }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: expect.arrayContaining([
                expect.objectContaining({ id: projectZero._id, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) }),
                expect.objectContaining({ id: projectOne._id, issues: expect.arrayContaining([{ type: "document", issue: `AccessValidatorError test` }]) })
            ])
        }));
    });

    test("Validator throws error/exception (not AccessValidatorError)", async () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        throw "validator exception test"
                    }
                }
            }
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { description: "x" } } 
        }, accessConfig, {})).rejects.toThrowError(`validator exception test`);
    });
});