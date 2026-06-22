import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectAssetObjects, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessValidatorError, defineUpdateAccessValidator } from "#src/access.js";
import { getRandomProject, Project, projectAssetUnfinishedStatus, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { Operation, UpdateManyPayload, UpdateManyReturnType, UpdateOnePayload, UpdateOneReturnType } from "#src/client.js";
import { getRandomProjectAsset, ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";

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

const testSimpleUpdateAssets = async <
    TOperation extends UpdateOperation,
    TResult extends TOperation extends "updateOne" ? UpdateOneReturnType<ProjectAsset> : UpdateManyReturnType<ProjectAsset>
> (
    operation: TOperation, 
    input: TOperation extends "updateOne" ? UpdateOnePayload<ProjectAsset> : UpdateManyPayload<ProjectAsset>, 
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
            // @ts-expect-error - testing wrong types
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
            // @ts-expect-error - testing wrong types 
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

    test("Update - dot notation - positional $ operator - scalar", async () => {
        const latestAssetID = projectZero.latestAssets[0], newLatestAssetID = projectAssetObjects.find(pa => !projectZero.latestAssets.includes(pa._id))!._id;

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id, "latestAssets": latestAssetID }, 
            update: { $set: { "latestAssets.$": newLatestAssetID } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update (many) - dot notation - positional $ operator - scalar", async () => {
        const latestAssetID = projectZero.latestAssets[0], newLatestAssetID = projectAssetObjects.find(pa => !projectZero.latestAssets.includes(pa._id))!._id;

        const projectRandomHasAsset = projectRandom.latestAssets.includes(latestAssetID);

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] }, "latestAssets": latestAssetID }, 
            update: { $set: { "latestAssets.$": newLatestAssetID } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(projectRandomHasAsset ? 2 : 1);
        expect(resultMany.modifiedCount).toBe(projectRandomHasAsset ? 2 : 1);
    });

    test("Update - dot notation - positional $ operator - nested", async () => {
        const unfinishedAssetID = projectZero.unfinishedAssets[0].id, newStatus = projectAssetUnfinishedStatus.filter(status => status !== projectZero.unfinishedAssets[0].status)[0];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id, "unfinishedAssets.id": unfinishedAssetID }, 
            update: { $set: { "unfinishedAssets.$.status": newStatus } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const resultMany = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] }, "unfinishedAssets.updatedAt": null }, 
            update: { $set: { "unfinishedAssets.$.updatedAt": new Date() } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(resultMany.acknowledged).toBe(true);
        expect(resultMany.matchedCount).toBe(2);
        expect(resultMany.modifiedCount).toBe(2);
    });

    test("Update - dot notation - positional $ operator - missing array field in query", async () => {
        const newStatus = projectAssetUnfinishedStatus.filter(status => status !== projectZero.unfinishedAssets[0].status)[0];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $set: { "unfinishedAssets.$.status": newStatus } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: `The positional operator did not find the match needed from the query.`,
        }));

        await expect(testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $set: { "unfinishedAssets.$.updatedAt": new Date() } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(expect.objectContaining({
            message: `The positional operator did not find the match needed from the query.`,
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

describe("Access - Update permissions - Alternative collection", async () => {
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
        document: AccessPermissions.ReadWrite,
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
        document: AccessPermissions.Read,
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

    const newDescription = "Updated by role";

    const database = await getMongoDBDatabase();

    beforeEach(async () => {
        await resetCUDCollections();
    });

    // updateOne
    test("Update document as owner (one), as uploader", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id && pa.uploaderID === userID)!;

        const result = await testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update document as owner (one), not uploader", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id && pa.uploaderID !== userID)!;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);  
    });

    test("Update document as contributor (one), as uploader", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        await database.collection<ProjectAsset>("projectAssetsCUD").updateOne({ _id: projectAsset._id }, { $set: { uploaderID: userID } });

        await expect(testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectAsset._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as contributor (one)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        await expect(testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectAsset._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as reader (one)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        await expect(testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectAsset._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as unknown (one)", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdateAssets("updateOne", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);        
    });

    // updateMany
    test("Update document as owner (many), as uploader", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id && pa.uploaderID === userID)!;

        const result = await testSimpleUpdateAssets("updateMany", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);
    });

    test("Update document as owner (many), not uploader", async () => {
        // Pick a project where we know an owner exists
        const project = projectObjects.find(p => p.access.owners.length > 0)!;
        const userID = project.access.owners[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id && pa.uploaderID !== userID)!;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdateAssets("updateMany", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
    });

    test("Update document as contributor (many)", async () => {
        const project = projectObjects.find(p => p.access.contributors.length > 0)!;
        const userID = project.access.contributors[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        await expect(testSimpleUpdateAssets("updateMany", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectAsset._id, issues: [{ type: "field", field: "description", issue: `Role "contributor" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as reader (many)", async () => {
        const project = projectObjects.find(p => p.access.readers.length > 0)!;
        const userID = project.access.readers[0];
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        await expect(testSimpleUpdateAssets("updateMany", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [
                { index: 0, id: projectAsset._id, issues: [{ type: "field", field: "description", issue: `Role "reader" does not have update access for field "description".` }] },
            ],
        }));
    });

    test("Update document as unknown (many)", async () => {
        const project = projectObjects[0];
        const userID = getRandomUser()._id;
        const projectAsset = projectAssetObjects.find(pa => pa.projectID === project._id)!;

        // This one returns 0 matches because no documents were found matching the filter & access filter
        const result = await testSimpleUpdateAssets("updateMany", { 
            filter: { _id: projectAsset._id }, 
            update: { $set: { description: newDescription } } 
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);        
    });

    // updateOne & upsert
    test("Upsert document as owner (one), as uploader", async () => {
        // Pick a project where we know an owner exists
        const project = structuredClone(projectObjects.find(p => p.access.owners.length > 0)!);
        const userID = project.access.owners[0];
        const upsertProjectAsset = getRandomProjectAsset([project]);

        upsertProjectAsset.uploaderID = userID;

        const { _id: upsertProjectAssetID, ...upsertUpdate } = upsertProjectAsset;

        const result = await testSimpleUpdateAssets("updateOne", { 
            filter: { _id: upsertProjectAssetID }, 
            update: { $set: upsertUpdate },
            options: { upsert: true }
        }, accessConfig, {}, userID);

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(0);
        expect(result.modifiedCount).toBe(0);
        expect(result.upsertedId).toEqual(upsertProjectAssetID);
        expect(result.upsertedCount).toBe(1);
    });

    test("Upsert document as owner (one), not uploader", async () => {
        // Pick a project where we know an owner exists
        const project = structuredClone(projectObjects.find(p => p.access.owners.length > 0)!);
        const userID = project.access.owners[0];
        const upsertProjectAsset = getRandomProjectAsset([project]);

        upsertProjectAsset.uploaderID = project.access.owners[1];

        const { _id: upsertProjectAssetID, ...upsertUpdate } = upsertProjectAsset;

        await expect(testSimpleUpdateAssets("updateOne", { 
            filter: { _id: upsertProjectAssetID }, 
            update: { $set: upsertUpdate },
            options: { upsert: true }
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No access role found for document` }] }]
        }));
    });

    test("Upsert document as contributor (one), as uploader", async () => {
        // Pick a project where we know an owner exists
        const project = structuredClone(projectObjects.find(p => p.access.contributors.length > 0)!);
        const userID = project.access.contributors[0];
        const upsertProjectAsset = getRandomProjectAsset([project]);

        upsertProjectAsset.uploaderID = userID;

        const { _id: upsertProjectAssetID, ...upsertUpdate } = upsertProjectAsset;

        await expect(testSimpleUpdateAssets("updateOne", { 
            filter: { _id: upsertProjectAssetID }, 
            update: { $set: upsertUpdate },
            options: { upsert: true }
        }, accessConfig, {}, userID)).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, issues: [{ type: "document", issue: `No create access for document` }] }]
        }));
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

    test("Update without field permission - positional $ operator - scalar", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                latestAssets: AccessPermissions.Read
            }, 
            document: AccessPermissions.ReadWrite,
        }];

        const latestAssetID = projectZero.latestAssets[0], newLatestAssetID = projectAssetObjects.find(pa => !projectZero.latestAssets.includes(pa._id))!._id;

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id, "latestAssets": latestAssetID }, 
            update: { $set: { "latestAssets.$": newLatestAssetID } } 
        }, accessConfig as AccessConfig<Document>, { })).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "latestAssets", issue: `Role "test" does not have update access for field "latestAssets".` }])}]
        }));
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

describe("Access - Update - $push & $pull operators", async () => {
    const database = await getMongoDBDatabase();

    beforeEach(async () => {
        await resetCUDCollections();
    });

    // $push
    test("$push - scalar value to array field (one)", async () => {
        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $push: { "config.tags": "newTag" } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const doc = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });
        expect(doc?.config.tags).toContain("newTag");
    });

    test("$push - scalar value to array field (many)", async () => {
        const result = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $push: { "config.tags": "newTag" } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(2);
        expect(result.modifiedCount).toBe(2);

        const docs = await database.collection<Project>("projectsCUD").find({ _id: { $in: [ projectZero._id, projectRandom._id ] } }).toArray();

        docs.forEach(doc => {
            expect(doc.config.tags).toContain("newTag");
        });
    });

    test("$push - object to object array field", async () => {
        const newAsset = { id: "new-asset-id", status: "design", updatedAt: null };

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - intentionally pushing an object to an array of objects
            update: { $push: { unfinishedAssets: newAsset } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const doc = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });
        expect(doc?.unfinishedAssets).toEqual(expect.arrayContaining([newAsset]));
    });

    test("$push - wrong element type", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - intentionally passing a wrong type to $push
            update: { $push: { "config.tags": 42 } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrow(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["config", "tags", 0], message: "Invalid input: expected string, received number" },
            ], null, 2),
            name: "ZodError"
        }));
    });

    test("$push - to non-array field", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - intentionally passing a non-array field to $push
            update: { $push: { name: "x" } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrow(expect.objectContaining({
            message: JSON.stringify([
                { expected: "string", code: "invalid_type", path: ["name"], message: "Invalid input: expected string, received array" },
            ], null, 2),
            name: "ZodError"
        }));
    });

    test("$push - without field permission", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                config: AccessPermissions.Read,
            },
            document: AccessPermissions.ReadWrite,
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $push: { "config.tags": "newTag" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "config", issue: `Role "test" does not have update access for field "config".` }]) }]
        }));
    });

    // $pull
    test("$pull - scalar value from array field (one)", async () => {
        const tagToRemove = projectZero.config.tags[0];

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $pull: { "config.tags": tagToRemove } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const doc = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });
        expect(doc?.config.tags).not.toContain(tagToRemove);
    });

    test("$pull - condition from array field", async () => {
        const tags = projectZero.config.tags.slice();
        const tagToRemove = tags.splice(0, 2);

        const result = await testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $pull: { "config.tags": { $in: tagToRemove } } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(1);
        expect(result.modifiedCount).toBe(1);

        const doc = await database.collection<Project>("projectsCUD").findOne({ _id: projectZero._id });
        expect(doc?.config.tags).toEqual(tags);
    });

    test("$pull - condition from array field (many)", async () => {
        const tags = projectZero.config.tags.slice();
        const tagToRemove = tags.splice(0, 2);

        const result = await testSimpleUpdate("updateMany", { 
            filter: { _id: { $in: [ projectZero._id, projectRandom._id ] } }, 
            update: { $pull: { "config.tags": { $in: tagToRemove } } } 
        }, [], { document: AccessPermissions.ReadWrite });

        expect(result.acknowledged).toBe(true);
        expect(result.matchedCount).toBe(2);
        expect(result.modifiedCount).toBe(2);

        const docs = await database.collection<Project>("projectsCUD").find({ _id: { $in: [ projectZero._id, projectRandom._id ] } }).toArray();

        docs.forEach(doc => {
            expect(doc.config.tags).toEqual(expect.not.arrayContaining(tagToRemove));
        });
    });

    test("$pull - from non-array field", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - intentionally passing a non-array field to $pull
            update: { $pull: { name: "x" } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(`Field "name" in $pull is not an array in the document schema`);
    });

    test("$pull - from non-existing field", async () => {
        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            // @ts-expect-error - intentionally passing a non-existing field to $pull
            update: { $pull: { unknownField: "x" } } 
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowError(`Field "unknownField" in $pull does not exist in the document schema`);
    });

    test("$pull - without field permission", async () => {
        const accessConfig: AccessConfig<Project> = [{
            role: "test",
            fields: {
                config: AccessPermissions.Read,
            },
            document: AccessPermissions.ReadWrite,
        }];

        await expect(testSimpleUpdate("updateOne", { 
            filter: { _id: projectZero._id }, 
            update: { $pull: { "config.tags": "tag1" } } 
        }, accessConfig as AccessConfig<Document>, {})).rejects.toThrowError(expect.objectContaining({
            message: `Unauthorized documents found`,
            unauthorizedDocuments: [{ index: 0, id: projectZero._id, issues: expect.arrayContaining([{ type: "field", field: "config", issue: `Role "test" does not have update access for field "config".` }]) }]
        }));
    });
});