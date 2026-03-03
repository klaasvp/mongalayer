import type { Collection, Document, Filter, UpdateResult } from "mongodb";
import z from "zod";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Sort, sortSchema } from "../schema/index.js";
import { updateSchema, UpdateSchema } from "../schema/update.js";
import { UpdatableDocument, UpdateAccessService } from "../access/update.js";
import { Debugging } from "../core.js";

export type UpdateOnePayload <TSchema extends Document> = {
    filter: FilterSchema,
    update: UpdateSchema,
    options?: { 
        upsert?: boolean,
        sort?: Sort
    }
}

export type UpdateOneReturnType<TSchema extends Document> = UpdateResult<TSchema>;

const payloadSchema: z.ZodType<UpdateOnePayload<Document>> = z.object({
    filter: filterSchema,
    update: updateSchema,
    options: z.object({
        upsert: z.boolean().optional(),
        sort: sortSchema.optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: UpdateAccessService, payload: UpdateOnePayload<TSchema>): Promise<UpdateOneReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = [stages.$query];

    if (stages.$role) {
        pipeline.push(...stages.$role);
    }

    if (payload.options?.sort) {
        pipeline.push({ $sort: payload.options.sort });
    }

    pipeline.push({ $project: stages.$project }, {
        $limit: 1
    });

    if (Debugging.isEnabled()) {
        console.debug(`Mongalayer - UpdateOne - pipeline:`, JSON.stringify(pipeline));
    }
    
    const documentsWithRole = await collection.aggregate(pipeline).toArray() as UpdatableDocument[];
    const documentsToUpdate = await accessService.validateDocumentsAccess(documentsWithRole, payload.update);

    if (documentsToUpdate.length === 0) {
        // If upsert is true and now matching documents were found, validate & upsert the document
        if (payload.options?.upsert === true) {
            const { doc: insertableDoc } = await accessService.getUpsertDocument(payload.filter, payload.update);

            return await collection.updateOne({ _id: insertableDoc._id } as Filter<Document>, { $set: insertableDoc } as Document, { upsert: true });
        } 
        // If no matching documents were found directly return
        else {
            return { acknowledged: true, modifiedCount: 0, matchedCount: 0, upsertedId: null, upsertedCount: 0 };
        }
    }

    accessService.validateUpdateFields(payload.update);

    return await collection.updateOne({ _id: documentsToUpdate[0] } as Filter<Document>, payload.update as Document, {});
}