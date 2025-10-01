import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessValidatorError, defineUpdateAccessValidator } from "#src/access.js";
import { getRandomProject, Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType, MongalayerError, MongalayerErrorType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { getRandomUser, User } from "#test/data/user.js";
import { InferActionPayload, InferActionReturnType, Operation } from "#src/actions/index.js";
import { AuthorizationErrorCode, DatabaseErrorCode, MongalayerErrorCode, ValidationErrorCode } from "#src/error.js";

const projectZero: Project = projectObjects[0], userZero: User = userObjects[0];
const randomProject = getRandomProject(userObjects);

const testSimpleOperation = async <
    TOperation extends Operation,
    TAction extends { operation: TOperation, collection: MongalayerCollectionType<Project>, database: string },
> (
    operation: TOperation, 
    input: InferActionPayload<TAction>,
    access: AccessConfig<Document>,
    accessDefaults: PartialDeep<AccessDefaults>,
    userID: string = userZero._id
): Promise<InferActionReturnType<TAction>> => {
    const collections: MongalayerCollections = {
        projectsCUD: {
            schema: projectSchema,
            access,
        },
    };

    const mongalayer = await getMongaLayerForCollections(collections, { accessDefaults });

    return (await mongalayer.executeRaw({
        database: dbName,
        collection: "projectsCUD" as MongalayerCollectionType<Project>,
        operation,
    }, input, { user: { id: userID } })) as InferActionReturnType<TAction>;
};

expect.extend({
    toThrowMongalayerError (actual: any, expected: { type: MongalayerErrorType, message: string, code: MongalayerErrorCode<typeof expected.type> }) {
        const { isNot } = this
        return {
            // do not alter your "pass" based on isNot. Vitest does it for you
            pass: actual instanceof MongalayerError && actual.type === expected.type && actual.message === expected.message && actual.code === expected.code,
            message: () => `"${actual}" is${isNot ? ' not' : ''} a MongalayerError`
        }
    }
})

interface CustomMatchers<R = unknown> {
    toThrowMongalayerError: (expected: { type: MongalayerErrorType, message: string, code: MongalayerErrorCode<typeof expected.type> }) => R
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

describe("Error - Database", () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Duplicate", async () => {
        await expect(testSimpleOperation("insertOne", { 
            document: projectZero
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowMongalayerError({ type: MongalayerErrorType.Database, message: "Duplicate key error", code: DatabaseErrorCode.DuplicateKey });
    });
});

describe("Error - Authorization", () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Insert - No permission", async () => {
        await expect(testSimpleOperation("insertOne", {     
            document: randomProject,
        }, [], {})).rejects.toThrowMongalayerError({ type: MongalayerErrorType.Authorization, message: "Unauthorized documents found", code: AuthorizationErrorCode.UnauthorizedInsert });
    });

    test("Update - No permission", async () => {
        await expect(testSimpleOperation("updateOne", {     
            filter: { _id: projectZero._id },
            update: { $set: { name: "New name" } }
        }, [], {})).rejects.toThrowMongalayerError({ type: MongalayerErrorType.Authorization, message: "Unauthorized documents found", code: AuthorizationErrorCode.UnauthorizedUpdate });
    });
});

describe("Error - Validation", () => {
    beforeEach(async () => {
        await resetCUDCollections();
    });

    test("Invalid field", async () => {
        await expect(testSimpleOperation("insertOne", { 
            document: { ...projectZero, invalidField: "invalid" } as any
        }, [], { document: AccessPermissions.ReadWrite })).rejects.toThrowMongalayerError({ type: MongalayerErrorType.Validation, message: "Failed to validate action payload", code: ValidationErrorCode.Unknown });
    });
});