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

export type DbPipelineTest = { 
    pipeline: PipelineSchema, 
    success: boolean, 
    message: string 
}

export type DbPipelineProjectTest = { 
    pipeline: PipelineSchema,
    properties: {
        present: (string | {prop: string, value: any})[],
        missing: string[]
    }, 
    message: string 
}