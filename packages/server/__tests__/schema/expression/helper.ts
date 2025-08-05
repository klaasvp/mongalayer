import { PipelineSchema } from "#src/schema/aggregate.js";
import { operatorSchema } from "#src/schema/expression/index.js";
import { SchemaTest } from "#test/data/schemaTest.js";
import { isMongoServerError, MongoAPIException, MongoDBException, ZodException } from "#test/lib/helper.js";
import { Db, Document } from "mongodb";
import { expect } from "vitest";

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

export const runTest = async (operator: Document, exceptions: ValueTest['exceptions'], database: Db) => {
    const zodResult = operatorSchema.safeParse(operator);

    if (exceptions?.zod) {
        expect(zodResult.success).toBe(false);
        expect(zodResult.error!.issues[0]).toHaveProperty('code', exceptions?.zod?.code);
        expect(zodResult.error!.issues[0].message).toContain(exceptions?.zod?.message);
    } else {
        expect(zodResult.success).toBe(true);
    }

    try {
        const result = await database.collection<SchemaTest>("schemaTest").aggregate([{
            $match: {$expr: operator}
        }], {}).toArray();

        if (exceptions?.mongodb) {
            throw "mongalayer.execute should have thrown an error";
        } else {
            expect(result).toHaveLength(0);
        }
    } catch (e) {
        if (exceptions?.mongodb && isMongoServerError(e)) {
            expect(e.code).toBe(exceptions?.mongodb?.code);
            expect(e.codeName).toBe(exceptions?.mongodb?.codeName);
            expect(e.message).toContain(exceptions?.mongodb?.message);
        } else {
            throw e;
        }
    }
}