import { Collection, Document, InsertManyResult } from "mongodb";
import z from "zod/v4";
import { InsertableDocument, InsertAccessService } from "#src/access/insert.js";

export type InsertManyPayload <TSchema extends Document> = {
    documents: InsertableDocument<TSchema>[],
    options?: {
        ordered?: boolean
    }
}

export type InsertManyReturnType<TSchema extends Document> = InsertManyResult<TSchema>;

const payloadOptionsSchema: z.ZodType<InsertManyPayload<Document>["options"]> = z.object({
    ordered: z.boolean().optional()
}).optional();

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: InsertAccessService, payload: InsertManyPayload<TSchema>): Promise<InsertManyReturnType<TSchema>> {
    // Validate the options payload
    payloadOptionsSchema.parse(payload.options);

    // Validate the documents payload based on its schema
    accessService.validateDocuments(payload.documents);
    
    await accessService.validateDocumentsAccess(payload.documents);

    return await collection.insertMany(payload.documents, payload.options);
}