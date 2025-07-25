import { Collection, Document, Filter } from "mongodb";
import { AccessService } from "../access.js";
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

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AccessService, payload: FindPayload<TSchema>): Promise<FindReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = [
        { $match: stages.$match }
    ];

    if (stages.$role) pipeline.push({ 
        $addFields: stages.$role
    });
    
    const result = await collection.aggregate(pipeline).toArray() as TSchema[];

    return result.map(doc => accessService.processFields(doc));
}