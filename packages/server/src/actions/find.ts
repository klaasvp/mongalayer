import type { Collection, Document, Filter } from "mongodb";
import z from "zod/v4";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Projection, projectionSchema, Sort, sortSchema } from "../schema/index.js";
import { QueryAccessService } from "../access/query.js";
import { Debugging } from "../core.js";

export type FindPayload <TSchema extends Document> = {
    filter: FilterSchema,
    options?: {
        projection?: Projection,
        limit?: number,
        skip?: number,
        sort?: Sort
    }
}

export type FindReturnType<TSchema extends Document> = TSchema[] | Partial<TSchema>[];

const payloadSchema: z.ZodType<FindPayload<Document>> = z.object({
    filter: filterSchema,
    options: z.object({
        projection: projectionSchema.optional(),
        limit: z.number().optional(),
        skip: z.number().optional(),
        sort: sortSchema.optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: QueryAccessService, payload: FindPayload<TSchema>): Promise<FindReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>, payload.options?.projection);

    const pipeline: Document[] = [stages.$query];

    if (stages.$role) pipeline.push(...stages.$role);

    // Sort?

    if (stages.$project) pipeline.push(stages.$project);

    if (payload.options?.sort && Object.keys(payload.options?.sort).length > 0) {
        pipeline.push({ $sort: payload.options.sort });
    }
    
    if (payload.options?.skip !== void 0 && payload.options?.limit !== void 0) {
        pipeline.push({ $limit: payload.options.skip + payload.options.limit });
    }

    if (payload.options?.skip) pipeline.push({ $skip: payload.options.skip });
    if (payload.options?.limit) pipeline.push({ $limit: payload.options.limit });

    if (Debugging.isEnabled()) {
        console.debug(`Mongalayer - ${payload.options?.limit === 1 ? "FindOne" : "Find"} - pipeline:`, JSON.stringify(pipeline));
    }
    
    const result = await collection.aggregate(pipeline).toArray() as TSchema[];

    return accessService.processFields(result, payload.options?.projection);
}