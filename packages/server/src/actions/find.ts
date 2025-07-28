import { Collection, Document, Filter } from "mongodb";
import { QueryService } from "../query.js";
import z, { ZodObject } from "zod/v4";
import { filterSchema, projectionSchema } from "./schema.js";

export type FindPayload <TSchema extends Document> = {
    filter: Filter<TSchema>,
    options?: {
        projection?: Document,
        limit?: number,
        skip?: number
    }
}

export type FindReturnType<TSchema extends Document> = TSchema[] | Partial<TSchema>[];

const payloadSchema: z.ZodType<FindPayload<Document>> = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional(),
        limit: z.number().optional(),
        skip: z.number().optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: QueryService, payload: FindPayload<TSchema>): Promise<FindReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>, payload.options?.projection);

    const pipeline: Document[] = [stages.$query];

    if (stages.$role) pipeline.push(stages.$role);

    // Sort?

    if (stages.$project) pipeline.push(stages.$project);

    if (payload.options?.limit) pipeline.push({ $limit: payload.options.limit });
    if (payload.options?.skip) pipeline.push({ $skip: payload.options.skip });
    
    const result = await collection.aggregate(pipeline).toArray() as TSchema[];

    return accessService.processFields(result, payload.options?.projection);
}