import type { Collection, Document } from "mongodb";
import z from "zod";
import { pipelineSchema, PipelineSchema } from "../schema/aggregate.js";
import { AggregationAccessService } from "../access/aggregation.js";
import { Debugging } from "../core.js";

export type AggregatePayload = {
    pipeline: PipelineSchema,
    options?: {
        //batchSize?: number
    }
}

export type AggregateReturnType<TSchema extends Document> = TSchema[] | Partial<TSchema>[] | Document[];

const payloadSchema: z.ZodType<AggregatePayload> = z.object({
    pipeline: pipelineSchema,
    options: z.object({
        //batchSize: z.number().optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AggregationAccessService, payload: AggregatePayload): Promise<AggregateReturnType<Document>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.pipeline);

    if (Debugging.isEnabled()) {
        console.debug("Mongalayer - Aggregate - pipeline:", JSON.stringify(stages.$pipeline));
    }

    const result = await collection.aggregate(stages.$pipeline, payload.options).toArray() as Document[];

    return result;
}