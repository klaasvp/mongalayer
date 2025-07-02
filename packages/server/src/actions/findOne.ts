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

const payloadSchema = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional()
    }).optional()
});

export default function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AccessService, payload: FindOnePayload<TSchema>): Promise<TSchema | null> {
    payloadSchema.parse(payload);

    const filterWithAccess = accessService.getFilter(payload.filter as Filter<Document>);

    return collection.findOne(filterWithAccess, payload.options);
}