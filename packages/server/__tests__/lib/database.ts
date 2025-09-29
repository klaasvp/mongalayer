import { Db, Document, MongoClient, ServerApiVersion } from "mongodb";
import { getRandomUsers } from "#test/data/user";
import { getRandomProjects } from "#test/data/project";
import { exampleObject1, FilterTest, filterTestsSchema, getFilterTests } from "#test/data/filterTest";
import { SchemaTest, schemaTestSchema } from "#test/data/schemaTest";
import { Mongalayer, MongalayerCollection, MongalayerCollections, MongalayerOptions } from "#src/core";
import { PartialDeep } from "type-fest";
import { getRandomProjectAssets } from "#test/data/projectAsset.js";

let client: MongoClient | null = null;

export const 
    userObjects = getRandomUsers(20), 
    projectObjects = getRandomProjects(200, userObjects), 
    filterTestObjects = getFilterTests(), 
    projectAssetObjects = getRandomProjectAssets(1000, projectObjects);

export const dbName = "test";

const collections: Record<string, Document[]> = {
    "users": userObjects,
    "projects": projectObjects,
    "projectsCUD": structuredClone(projectObjects),
    "projectAssets": projectAssetObjects,
    "filterTest": filterTestObjects,
    "filterTestSolo": [exampleObject1]
}

export const getMongoDBClient = async (): Promise<MongoClient> => {
    if (!client) {
        client = new MongoClient(process.env.__MONGALAYER_DB_URI!, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: false,
                deprecationErrors: true
            },
            retryWrites: true,
        });

        const database = client.db(dbName);

        // Clear the database as this 
        for (const [collectionName, objects] of Object.entries(collections)) {
            await database.collection(collectionName).deleteMany({});
            await database.collection(collectionName).insertMany(objects);
        }
    }

    return client;
}

export const getMongoDBDatabase = async (): Promise<Db> => {
    await getMongoDBClient();

    return client!.db(dbName);
}

export const getMongaLayerForFilterTest = async (options?: { debugging: boolean }): Promise<Mongalayer> => {
    options = {
        debugging: false,
        ...options
    };

    const filterTestCollection: MongalayerCollection<FilterTest> = { schema: filterTestsSchema, access: [] };
    const schemaCollection: MongalayerCollection<SchemaTest> = { schema: schemaTestSchema, access: [] };

    const collections: MongalayerCollections = {
        filterTest: filterTestCollection,
        filterTestSolo: filterTestCollection,
        schema: schemaCollection
    }

    await getMongoDBClient();

    return new Mongalayer(client!, collections, {
        debugging: options.debugging,
        useSessions: true
    });
}

export const getMongaLayerForCollections = async (collections: MongalayerCollections, options?: PartialDeep<MongalayerOptions>): Promise<Mongalayer> => {
    options = {
        debugging: false,
        useSessions: true,
        ...options
    };

    await getMongoDBClient();

    return new Mongalayer(client!, collections, options);
}

export const resetCUDCollections = async () => {
    const database = await getMongoDBDatabase();

    const CUDCollections: string[] = ["projectsCUD"];

    // Clear the database as this 
    for (const collectionName of CUDCollections) {
        const objects = collections[collectionName];
        
        await database.collection(collectionName).deleteMany({});
        await database.collection(collectionName).insertMany(objects);
    }
}

process.on('SIGTERM', async () => {    
    if (client) {
        console.info('Closing MongoDB Client');
        await client.close();
        client = null;
    } else {
        console.info('Skipping MongoDB Client');
    }

    process.exit(0)
});