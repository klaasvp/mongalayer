import { MongoClient, ServerApiVersion } from "mongodb";
import { getRandomUsers, User } from "../data/user";
import { getRandomProjects, Project } from "../data/project";
import { MongoMemoryServer } from 'mongodb-memory-server';
import { exampleObject1, FilterTest, getFilterTests } from "../data/filterTest";
import { SchemaTest } from "../data/schemaTest";

const dbName = "test";

const userObjects = getRandomUsers(20), projectObjects = getRandomProjects(50, userObjects), filterTestObjects = getFilterTests();

export default async function (globalConfig: any, projectConfig: any) {
    console.log("Setting up JEST");

    const mongod = await MongoMemoryServer.create({
        instance: { dbName },
        binary: { checkMD5: false }
    });

    const client = new MongoClient(mongod.getUri(), {
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
    await database.collection<FilterTest>("filterTest").insertMany(filterTestObjects);
    await database.collection<FilterTest>("filterTestSolo").insertOne(exampleObject1);
    await database.createCollection<SchemaTest>("schemaTest");

    await database.collection<SchemaTest>("schemaTest").createIndexes([
        { key: { "property": "2dsphere" } },
        { key: { "property": "2d" } }
    ]);

    for (const collectionName of ["filterTest", "filterTestSolo"]) {
        await database.collection<FilterTest>(collectionName).createIndexes([
            { key: { "point": "2dsphere" } },
            { key: { "multiPoint": "2dsphere" } },
            { key: { "lineString": "2dsphere" } },
            { key: { "multiLineString": "2dsphere" } },
            { key: { "polygon": "2dsphere" } },
            { key: { "multiPolygon": "2dsphere" } },
            { key: { "geometryCollection": "2dsphere" } },
            { key: { "coordinates": "2dsphere" } },
            { key: { "coordinates": "2d" } }
        ])
    };

    globalThis.$md = mongod;
    globalThis.$mdb = {
        client,
        name: dbName,
        db: database,
        objects: {
            users: userObjects,
            projects: projectObjects,
            filterTests: filterTestObjects
        }
    };
}