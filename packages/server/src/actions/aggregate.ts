import { Collection, Document, Filter } from "mongodb";
import { QueryService } from "../query.js";
import z, { ZodObject } from "zod/v4";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Projection, projectionSchema, Sort, sortSchema } from "../schema/index.js";
import { pipelineSchema, PipelineSchema } from "#src/schema/aggregate.js";

export type AggregatePayload = {
    pipeline: PipelineSchema,
    options?: {
        batchSize?: number
    }
}

export type AggregateReturnType<TSchema extends Document> = TSchema[] | Partial<TSchema>[];

const payloadSchema: z.ZodType<AggregatePayload> = z.object({
    pipeline: pipelineSchema,
    options: z.object({
        batchSize: z.number().optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: QueryService, payload: AggregatePayload): Promise<AggregateReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    //const stages = accessService.getStages(payload.filter as Filter<Document>, payload.options?.projection);

    const pipeline: Document[] = payload.pipeline;

    //if (stages.$role) pipeline.push(...stages.$role);
    
    const result = await collection.aggregate(pipeline, payload.options).toArray() as TSchema[];

    return accessService.processFields(result);
}