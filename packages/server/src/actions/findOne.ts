import type { Collection, Db, Document } from "mongodb";
import z from "zod";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Projection, projectionSchema, Sort, sortSchema } from "../schema/index.js";
import find, { FindPayload } from "./find.js";
import { QueryAccessService } from "../access/query.js";
import { Debugging } from "../core.js";

export type FindOnePayload<TSchema extends Document> = {
    filter: FilterSchema,
    options?: {
        projection?: Projection
        sort?: Sort
    }
}

export type FindOneReturnType<TSchema extends Document> = TSchema | Partial<TSchema> | null;

const payloadSchema: z.ZodType<FindOnePayload<Document>> = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional(),
        sort: sortSchema.optional()
    }).optional()
});

export default async function <TSchema extends Document> (database: Db, accessService: QueryAccessService, payload: FindOnePayload<TSchema>): Promise<FindOneReturnType<TSchema>> {
    payloadSchema.parse(payload);

    const findPayload: FindPayload<TSchema> = structuredClone(payload);
    
    findPayload.options = {
        ...findPayload.options,
        limit: 1
    };

    const result = await find(database, accessService, findPayload);

    if (result.length === 0) return null;

    return result[0] as Partial<TSchema>;
}