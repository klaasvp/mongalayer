import { describe, expect, test, beforeAll } from "@jest/globals";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "@mongalayer/server";
import { getRandomUsers, User, userSchema } from "../data/user.js";
import { getRandomProjects, Project, projectSchema } from "../data/project.js";
import { AccessConfig } from "../../server/src/access.js";
import { JwtPayload } from "jsonwebtoken";

const dbName = "test";

let client: MongoClient;

const userObjects = getRandomUsers(20), projectObjects = getRandomProjects(50, userObjects);

beforeAll(async () => {
    client = new MongoClient(process.env.MONGO_URL!, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: true
        },
        retryWrites: true,
    });

    const database = client.db(dbName);

    await database.collection<User>("users").insertMany(userObjects);
    await database.collection<Project>("projects").insertMany(projectObjects); 
});
    
afterAll(async () => {
    await client.close();
});
 
describe('Schema missing', () => {
    let mongalayer: Mongalayer, userZero: User;

    beforeAll(async () => {
        const collections: MongalayerCollections = {}
    
        userZero = userObjects[0];
    
        mongalayer = new Mongalayer(client, collections, {
            debugging: true,
            useSessions: true
        });
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
    
        mongalayer = new Mongalayer(client, collections, {
            debugging: true,
            useSessions: true
        });
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
    
        mongalayer = new Mongalayer(client, collections, {
            debugging: true,
            useSessions: true
        });
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
    
        mongalayer = new Mongalayer(client, collections, {
            debugging: true,
            useSessions: true
        });
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