import { Collection, Document, Filter, UpdateResult } from "mongodb";
import z from "zod/v4";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Sort, sortSchema } from "../schema/index.js";
import { updateSchema, UpdateSchema } from "../schema/update.js";
import { UpdatableDocument, UpdateAccessService } from "../access/update.js";

export type UpdateManyPayload <TSchema extends Document> = {
    filter: FilterSchema,
    update: UpdateSchema,
    options?: { 
    }
}

export type UpdateManyReturnType<TSchema extends Document> = UpdateResult<TSchema>;

const payloadSchema: z.ZodType<UpdateManyPayload<Document>> = z.object({
    filter: filterSchema,
    update: updateSchema,
    options: z.object({
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: UpdateAccessService, payload: UpdateManyPayload<TSchema>): Promise<UpdateManyReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = [stages.$query];

    if (stages.$role) {
        pipeline.push(...stages.$role);
    }

    pipeline.push({ $project: {
        _id: 1, // Explicitly set it so there's no confusion over it being included
        __mongalayer_role: 1
    } });
    
    const documentsWithRole = await collection.aggregate(pipeline).toArray() as UpdatableDocument[];
    const documentsToUpdate = await accessService.validateDocumentsAccess(documentsWithRole, payload.update);

    if (documentsToUpdate.length === 0) {
        return { acknowledged: true, modifiedCount: 0, matchedCount: 0, upsertedId: null, upsertedCount: 0 };
    }

    accessService.validateUpdateFields(payload.update);

    return await collection.updateMany({ _id: { $in: documentsToUpdate } } as Filter<Document>, payload.update as Document, {});
}