import { MongoServerError } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "@mongalayer/server";
import { FilterTest, filterTestsSchema } from "../../../../data/filterTest";
import { SchemaTest, schemaTestSchema } from "../../../../data/schemaTest";

export const isMongoServerError = (e: any): e is MongoServerError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoServerError"
}; 

export const getMongaLayerForFilterTest = () => {
    const filterTestCollection: MongalayerCollection<FilterTest> = { schema: filterTestsSchema, access: [] };
    const schemaCollection: MongalayerCollection<SchemaTest> = { schema: schemaTestSchema, access: [] };

    const collections: MongalayerCollections = {
        filterTest: filterTestCollection,
        filterTestSolo: filterTestCollection,
        schema: schemaCollection
    }

    return new Mongalayer(globalThis.$mdb.client, collections, {
        //debugging: true,
        useSessions: true
    });
}