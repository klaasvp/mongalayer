import { describe, expect, test, beforeAll } from "@jest/globals";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "@mongalayer/server";
import { User, userSchema } from "../data/user.js";
import { Project, projectSchema } from "../data/project.js";
import { JwtPayload } from "jsonwebtoken";

describe('Schema missing', () => {
    let mongalayer: Mongalayer, userZero: User;

    beforeAll(async () => {
        const collections: MongalayerCollections = {}
    
        userZero = globalThis.$mdb.objects.users[0];

        mongalayer = new Mongalayer(globalThis.$mdb.client, collections, {
            debugging: true,
            useSessions: true
        });
    });

    test("random test", async () => {
        const result = await mongalayer.execute<User>({
            database: globalThis.$mdb.db,
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
    
        userZero = globalThis.$mdb.objects.users[0];
    
        mongalayer = new Mongalayer(globalThis.$mdb.client, collections, {
            debugging: true,
            useSessions: true
        });
    });

    test("findOne - No filters", async () => {
        const result = await mongalayer.execute<User>({
            database: globalThis.$mdb.db,
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
            database: globalThis.$mdb.db,
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
            database: globalThis.$mdb.db,
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
    
        userZero = globalThis.$mdb.objects.users[0];
        userOne = globalThis.$mdb.objects.users[1];

        userZeroAccessPayload = {
            user: {
                sub: userZero._id
            }
        };
    
        mongalayer = new Mongalayer(globalThis.$mdb.client, collections, {
            debugging: true,
            useSessions: true
        });
    });

    test("findOne - self filter", async () => {
        const result = await mongalayer.execute<User>({
            database: globalThis.$mdb.db,
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
            database: globalThis.$mdb.db,
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
    
        userZero = globalThis.$mdb.objects.users[0];
        userZeroAccessPayload = {
            user: {
                sub: userZero._id
            }
        };

        projectWithUserAsOwner = globalThis.$mdb.objects.projects.find(project => project.access.owners.includes(userZero._id))!;
        projectWithoutUserAsOwner = globalThis.$mdb.objects.projects.find(project => !project.access.owners.includes(userZero._id))!;
    
        mongalayer = new Mongalayer(globalThis.$mdb.client, collections, {
            debugging: true,
            useSessions: true
        });
    });

    test("findOne - project as owner = project", async () => {
        const result = await mongalayer.execute<User>({
            database: globalThis.$mdb.db,
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
            database: globalThis.$mdb.db,
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