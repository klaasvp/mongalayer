import { Collection, Document, InsertManyResult } from "mongodb";
import z from "zod/v4";
import { InsertableDocument, InsertAccessService } from "#src/access/insert.js";

export type InsertPayload <TSchema extends Document> = {
    documents: InsertableDocument<TSchema>[],
    options?: {
        ordered?: boolean
    }
}

export type InsertReturnType<TSchema extends Document> = InsertManyResult<TSchema>;

const payloadOptionsSchema: z.ZodType<InsertPayload<Document>["options"]> = z.object({
    ordered: z.boolean().optional()
}).optional();

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: InsertAccessService, payload: InsertPayload<TSchema>): Promise<InsertReturnType<TSchema>> {
    // Validate the options payload
    payloadOptionsSchema.parse(payload.options);

    // Validate the documents payload based on its schema
    accessService.validateDocuments(payload.documents);
    
    accessService.validateDocumentsAccess(payload.documents);

    return await collection.insertMany(payload.documents, payload.options);
}