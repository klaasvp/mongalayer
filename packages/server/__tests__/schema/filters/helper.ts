import { Document, Filter, MongoAPIError, MongoServerError } from "mongodb";
import { FilterTest } from "#test/data/filterTest";
import { z } from "zod/v4";
import { FilterSchema } from "#src/schema/query.js";
import { MongoAPIException, MongoDBException, ZodException } from "#test/lib/helper.js";

export * from "../../lib/helper.js";

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
    filter: FilterSchema, 
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