import { Collection, Document, Filter } from "mongodb";
import { AccessService } from "../access.js";
import z, { ZodObject } from "zod/v4";
import { filterSchema, projectionSchema } from "./schema.js";
import { MongaLayerPayloadError } from "./types.js";

export type FindOnePayload<TSchema extends Document> = {
    filter: Filter<TSchema>,
    options?: {
        projection?: Document
    }
}

export type FindOneReturnType<TSchema extends Document> = TSchema | Partial<TSchema> | null;

const payloadSchema = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AccessService, payload: FindOnePayload<TSchema>): Promise<FindOneReturnType<TSchema>> {
    payloadSchema.parse(payload);

    const filterWithAccess = accessService.getFilter(payload.filter as Filter<Document>);

    return collection.findOne(filterWithAccess, payload.options);
}