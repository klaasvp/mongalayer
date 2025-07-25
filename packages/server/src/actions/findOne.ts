import { Collection, Document, Filter } from "mongodb";
import { QueryService } from "../query.js";
import z, { ZodObject } from "zod/v4";
import { filterSchema, projectionSchema } from "./schema.js";
import find, { FindPayload } from "./find.js";

export type FindOnePayload<TSchema extends Document> = {
    filter: Filter<TSchema>,
    options?: {
        projection?: Document
    }
}

export type FindOneReturnType<TSchema extends Document> = TSchema | Partial<TSchema> | null;

const payloadSchema: z.ZodType<FindOnePayload<Document>> = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: QueryService, payload: FindOnePayload<TSchema>): Promise<FindOneReturnType<TSchema>> {
    payloadSchema.parse(payload);

    const findPayload: FindPayload<TSchema> = structuredClone(payload);
    
    findPayload.options = {
        ...findPayload.options,
        limit: 1
    };

    const result = await find(collection, accessService, findPayload);

    if (result.length === 0) return null;

    return result[0] as Partial<TSchema>;
}