import { MongoClient, ServerApiVersion } from "mongodb";
import { getRandomUsers, User } from "../data/user";
import { getRandomProjects, Project } from "../data/project";
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbName = "test";

const userObjects = getRandomUsers(20), projectObjects = getRandomProjects(50, userObjects);

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

    globalThis.$md = mongod;
    globalThis.$mdb = {
        client,
        db: dbName,
        objects: {
            users: userObjects,
            projects: projectObjects
        }
    };
}