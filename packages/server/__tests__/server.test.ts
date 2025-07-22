import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { User, userSchema } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { JwtPayload } from "jsonwebtoken";
import { dbName, getMongaLayerForCollections, projectObjects, userObjects } from "#test/lib/database";

describe('Schema missing', () => {
    let mongalayer: Mongalayer, userZero: User;

    beforeAll(async () => {
        const collections: MongalayerCollections = {}
    
        userZero = userObjects[0];

        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("random test", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {}
            }
        }, {});

        expect(result).toStrictEqual(userZero);
    });
});

describe('Access empty', () => {
    let mongalayer: Mongalayer, userZero: User;

    beforeAll(async () => {
        const collections: MongalayerCollections = {
            users: {
                schema: userSchema,
                access: []
            }
        }
    
        userZero = userObjects[0];
    
        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("findOne - No filters", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {}
            }
        }, {});

        expect(result).toStrictEqual(userZero);
    });

    test("findOne - _id filter - existing", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {
                    _id: userZero._id
                }
            }
        }, {});

        expect(result).toStrictEqual(userZero);
    });

    test("findOne - _id filter - non-existing", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {
                    _id: "abc"
                }
            }
        }, {});

        expect(result).toStrictEqual(null);
    });
});

describe('Access user', () => {
    let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, userOne: User;

    beforeAll(async () => {
        const userCollection: MongalayerCollection<User> = {
            schema: userSchema,
            access: [{
                role: "self",
                filter: {
                    _id: "%%user.sub"
                }
            }]
        };

        const collections: MongalayerCollections = {
            users: userCollection
        }
    
        userZero = userObjects[0];
        userOne = userObjects[1];

        userZeroAccessPayload = {
            user: {
                sub: userZero._id
            }
        };

        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("findOne - self filter", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {
                    _id: userZero._id
                }
            }
        }, userZeroAccessPayload);

        expect(result).toStrictEqual(userZero);
    });

    test("findOne - other filter", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "users",
            operation: "findOne",
            payload: {
                filter: {
                    _id: userOne._id
                }
            }
        }, userZeroAccessPayload);

        expect(result).toStrictEqual(null);
    });
});

describe('Access project - user owner', () => {
    let mongalayer: Mongalayer, userZero: User, userZeroAccessPayload: JwtPayload, projectWithoutUserAsOwner: Project, projectWithUserAsOwner: Project;

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = {
            schema: projectSchema,
            access: [{
                role: "owner",
                filter: {
                    "access.owners": {"$in": ["%%user.sub"]}
                }
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

        projectWithUserAsOwner = projectObjects.find(project => project.access.owners.includes(userZero._id))!;
        projectWithoutUserAsOwner = projectObjects.find(project => !project.access.owners.includes(userZero._id))!;

        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("findOne - project as owner = project", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "projects",
            operation: "findOne",
            payload: {
                filter: {
                    _id: projectWithUserAsOwner._id
                }
            }
        }, userZeroAccessPayload);

        expect(result).toStrictEqual(projectWithUserAsOwner);
    });

    test("findOne - project not as owner = null", async () => {
        const result = await mongalayer.execute<User>({
            database: dbName,
            collection: "projects",
            operation: "findOne",
            payload: {
                filter: {
                    _id: projectWithoutUserAsOwner._id
                }
            }
        }, userZeroAccessPayload);

        expect(result).toStrictEqual(null);
    });
});