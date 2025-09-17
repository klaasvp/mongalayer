import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults } from "#src/access.js";
import { getRandomProject, Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document, InsertManyResult, InsertOneResult } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { Operation } from "#src/client.js";

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

// InsertOne uses InsertMany behind the scenes, so the result of both should be the same
describe('Access - Insert - One vs Many', () => {
    const newProject = getRandomProject(userObjects);

    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("No roles, default = undefined", async () => {
        await expect(testSimpleInsert("insertOne", { document: newProject }, [], {})).rejects.toThrowError(`No (default) create access for document`);
    });

    test("No roles, default = true", async () => {
        const result = await testSimpleInsert("insertOne", { document: newProject }, [], { create: true });

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("No roles, default = false", async () => {
        await expect(testSimpleInsert("insertOne", { document: newProject }, [], { create: false })).rejects.toThrowError(`No (default) create access for document`);
    });

    test("Insert One", async () => {
        const result = await testSimpleInsert("insertOne", { document: newProject }, [], { create: true });

        expect(result.acknowledged).toBe(true);
        expect(result.insertedId).toBe(newProject._id);
    });

    test("Insert Many", async () => {
        const result = await testSimpleInsert("insertMany", { documents: [newProject] }, [], { create: true });

        expect(result.acknowledged).toBe(true);
        expect(Object.keys(result.insertedIds)).toHaveLength(1);
        expect(result.insertedIds[0]).toBe(newProject._id);
    });

    test("Insert One - Duplicate", async () => {
        await expect(testSimpleInsert("insertOne", { document: projectZero }, [], { create: true })).rejects.toThrowError(`E11000 duplicate key error collection: test.projectsCUD index: _id_ dup key: { _id: "${projectZero._id}" }`);
    });

    test("Insert Many - Duplicate", async () => {
        await expect(testSimpleInsert("insertMany", { documents: [projectZero] }, [], { create: true })).rejects.toThrowError(`E11000 duplicate key error collection: test.projectsCUD index: _id_ dup key: { _id: "${projectZero._id}" }`);
    });
});

describe('Access - Create permissions', () => {
    describe('Owner (create = true), contributor (create = false), reader (create = undefined)', () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "owner",
            filter: {
                "access.owners": {"$in": ["%%user.id"]}
            },
            create: true
        }, {
            role: "contributor",
            filter: {
                "access.contributors": {"$in": ["%%user.id"]}
            },
            create: false
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

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(`No create access for document`);
        });

        test("Create document as reader", async () => {
            const newProject = getRandomProject(userObjects);
            newProject.access.readers.push(newUser._id);      

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(`No create access for document`);
        });

        test("Create document as unknown", async () => {
            const newProject = getRandomProject(userObjects);

            await expect(testSimpleInsert("insertOne", { document: newProject }, accessConfig, {}, newUser._id)).rejects.toThrowError(`No access role found for document`);
        });
    });
});