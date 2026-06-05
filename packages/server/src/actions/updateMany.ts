import type { Collection, Db, Document, Filter, UpdateResult } from "mongodb";
import z from "zod";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { updateSchema, UpdateSchema } from "../schema/update.js";
import { UpdatableDocument, UpdateAccessService } from "../access/update.js";
import { Debugging } from "../core.js";

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

export default async function <TSchema extends Document> (database: Db, accessService: UpdateAccessService, payload: UpdateManyPayload<TSchema>): Promise<UpdateManyReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = stages.$pipeline;

    pipeline.push({ $project: stages.$project });

    if (Debugging.isEnabled()) {
        console.debug(`Mongalayer - UpdateMany - pipeline:`, JSON.stringify(pipeline));
    }
    
    const documentsWithRole = await database.aggregate(pipeline).toArray() as UpdatableDocument[];
    const documentsToUpdate = await accessService.validateDocumentsAccess(documentsWithRole, payload.update);

    if (documentsToUpdate.length === 0) {
        return { acknowledged: true, modifiedCount: 0, matchedCount: 0, upsertedId: null, upsertedCount: 0 };
    }

    accessService.validateUpdateFields(payload.update);

    const updateFilter = accessService.getFinalUpdateFilter({ _id: { $in: documentsToUpdate } }, payload.filter, payload.update);

    const collection = database.collection<TSchema>(accessService.collection);
    
    return await collection.updateMany(updateFilter, payload.update as Document, {});
}