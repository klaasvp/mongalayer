import { PipelineSchema } from "#src/schema/aggregate.js";
import { MongoAPIException, MongoDBException, ZodException } from "#test/lib/helper.js";

export type ValueTest = {
    value: any,
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
    pipeline: PipelineSchema, 
    success: boolean, 
    message: string 
}