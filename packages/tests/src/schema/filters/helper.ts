import { Document, Filter, MongoAPIError, MongoServerError } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "@mongalayer/server";
import { FilterTest, filterTestsSchema } from "../../../data/filterTest";
import { SchemaTest, schemaTestSchema } from "../../../data/schemaTest";
import { z } from "zod/v4";

export type MongoDBException = {
    code: number,
    codeName: string,
    message: string
};

export type MongoAPIException = {
    message: string
};

export type ZodException = {
    code: string,
    message: string
}

export type ValueTest = ({
    filter: any | Filter<Document>,
    value?: never
} | {
    filter?: never,
    value: any,
}) & { 
    success: boolean, 
    message: string, 
    exceptions?: { 
        zod?: ZodException, 
        mongodb?: MongoDBException 
        mongoapi?: MongoAPIException
    } 
};

export type DbTest = { 
    filter: Filter<FilterTest>, 
    success: boolean, 
    message: string 
}

export const isMongoServerError = (e: any): e is MongoServerError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoServerError"
}; 

export const isMongoInvalidArgumentError = (e: any): e is MongoAPIError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoInvalidArgumentError";
}; 

export const isZodError = (e: any): e is z.ZodError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e instanceof z.ZodError;
}; 

export const getMongaLayerForFilterTest = (options?: { debugging: boolean }) => {
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

    return new Mongalayer(globalThis.$mdb.client, collections, {
        debugging: options.debugging,
        useSessions: true
    });
}