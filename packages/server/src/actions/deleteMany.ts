import type { Collection, Db, Document, Filter } from "mongodb";
import z from "zod";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { DeletableDocument, DeleteAccessService } from "../access/delete.js";
import { Debugging } from "../core.js";

export type DeleteManyPayload <TSchema extends Document> = {
    filter: FilterSchema,
    options?: { }
}

export type DeleteManyReturnType = { acknowledged: boolean, deletedCount: number };

const payloadSchema: z.ZodType<DeleteManyPayload<Document>> = z.object({
    filter: filterSchema,
    options: z.object({
    }).optional()
});

export default async function <TSchema extends Document> (database: Db, accessService: DeleteAccessService, payload: DeleteManyPayload<TSchema>): Promise<DeleteManyReturnType> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = stages.$pipeline;

    if (stages.usingRoles === false && accessService.accessDefaults.delete === false) {
        throw `Delete permission error: No roles exist for the collection and default delete permission is set to false.`
    }

    pipeline.push({ $project: {
        _id: 1, // Explicitly set it so there's no confusion over it being included
        __mongalayer_role: 1
    } });
    
    if (Debugging.isEnabled()) {
        console.debug("Mongalayer - DeleteMany - pipeline:", JSON.stringify(pipeline));
    }
    
    const documentsWithRole = await database.aggregate(pipeline).toArray() as DeletableDocument[];

    const documentsToDelete = stages.usingRoles
        ? accessService.documentsEligibleForDelete(documentsWithRole)
        : documentsWithRole.map(({ _id }) => _id);

    // If no matching documents were found directly return
    if (documentsToDelete.length === 0) return { acknowledged: true, deletedCount: 0 };

    const collection = database.collection<TSchema>(accessService.collection);

    return await collection.deleteMany({ _id: { $in: documentsToDelete }} as Filter<Document>);
}