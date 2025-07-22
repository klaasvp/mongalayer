import { Document, Filter, MongoAPIError, MongoServerError } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { FilterTest, filterTestsSchema } from "#test/data/filterTest";
import { SchemaTest, schemaTestSchema } from "#test/data/schemaTest";
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
    message: string
} & ({ 
    success: boolean, 
    exceptions?: { 
        zod?: ZodException, 
        mongodb?: MongoDBException 
        mongoapi?: MongoAPIException
    } 
} | {
    success?: never, 
    exceptions: { 
        zod?: ZodException, 
        mongodb?: MongoDBException 
        mongoapi?: MongoAPIException
    } 
});

export type DbTest = { 
    filter: Filter<FilterTest>, 
    success: boolean, 
    message: string 
}

export type DbProjectTest = { 
    projection: Document,
    properties: {
        present: string[],
        missing: string[]
    }, 
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