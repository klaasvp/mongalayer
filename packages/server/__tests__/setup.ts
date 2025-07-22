import { FilterTest } from '#test/data/filterTest';
import { Project } from '#test/data/project';
import { SchemaTest } from '#test/data/schemaTest';
import { User } from '#test/data/user';
import { dbName } from '#test/lib/database';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer, client: MongoClient;

export async function setup () {
    console.log("Setting up Vitest");

    mongod = await MongoMemoryServer.create({
        instance: { dbName },
        binary: { checkMD5: false }
    });

    process.env.__MONGALAYER_DB_URI = mongod.getUri();

    client = new MongoClient(process.env.__MONGALAYER_DB_URI!, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: true
        },
        retryWrites: true,
    });

    const database = client.db(dbName);

    await database.createCollection<User>("users");
    await database.createCollection<Project>("projects"); 
    await database.createCollection<FilterTest>("filterTest");
    await database.createCollection<FilterTest>("filterTestSolo");
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
}

export async function teardown () {
    console.log("Tearing down Vitest");
    
    await client.close();
    await mongod.stop();
}