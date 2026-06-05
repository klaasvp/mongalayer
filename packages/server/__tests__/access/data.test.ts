import { describe, expect, test, beforeAll } from "vitest";
import { MongalayerCollection } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongoDBClient, userObjects } from "#test/lib/database";
import { AccessConfig, AccessPermissions } from "#src/access";
import { ValidationError } from "@mongalayer/core";
import { MongoClient } from "mongodb";
import { QueryAccessService } from "#src/access/query";

const accessDefaults = { document: AccessPermissions.Read, delete: false };

describe('Access - Data (accessPayload)', () => {
    let client: MongoClient, userZero = userObjects[0];

    beforeAll(async () => {
        client = await getMongoDBClient();
    });

    const buildService = (collection: string, access: AccessConfig, accessData: Record<string, any>) =>
        new QueryAccessService(client, dbName, collection, accessData, access, userSchema, accessDefaults);

    test("Throws when a referenced top-level access data property is missing", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: { _id: "%%sub" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, {})).toThrow(ValidationError);
    });

    test("Throws when a referenced nested access data property is missing", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: { _id: "%%user.sub" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, { user: {} })).toThrow(ValidationError);
    });

    test("Throws when the parent of a referenced nested property is missing", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: { _id: "%%user.sub" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, {})).toThrow(ValidationError);
        expect(() => buildService("users", collection.access as AccessConfig, {})).toThrow("Access filter references missing access data property: user.sub");
    });

    test("Does not throw when all referenced access data properties exist", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: { _id: "%%user.sub" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, { user: { sub: userZero._id } })).not.toThrow();
    });

    test("Does not throw when the referenced access data property exists but is null", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: { _id: "%%user.sub" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, { user: { sub: null } })).not.toThrow();
    });

    test("Throws when any role in a multi-role config references missing access data", () => {
        const collection: MongalayerCollection<Project> = {
            schema: projectSchema,
            access: [{
                role: "owner",
                filter: { "access.owners": { "$in": ["%%user.sub"] } }
            }, {
                role: "contributor",
                filter: { "access.contributors": { "$in": ["%%user.missing"] } }
            }]
        };

        expect(() => buildService("projects", collection.access as AccessConfig, { user: { sub: userZero._id } })).toThrow(ValidationError);
    });

    test("Does not throw when no access data is required by the filters", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "static",
                filter: { _id: "static-value" }
            }]
        };

        expect(() => buildService("users", collection.access as AccessConfig, {})).not.toThrow();
    });

    test("Does not throw when there are no roles defined", () => {
        const collection: MongalayerCollection<User> = {
            schema: userSchema,
            access: []
        };

        expect(() => buildService("users", collection.access as AccessConfig, {})).not.toThrow();
    });
});
