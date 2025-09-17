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
    accessDefaults: PartialDeep<AccessDefaults>
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
    }, input, {user: {id: userZero._id}}) as TResult;
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
