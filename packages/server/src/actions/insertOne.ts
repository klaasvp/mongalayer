import { Collection, Document, InsertOneResult } from "mongodb";
import z from "zod/v4";
import { InsertableDocument, InsertAccessService } from "#src/access/insert.js";
import insert from "./insert.js";

export type InsertPayload <TSchema extends Document> = {
    document: InsertableDocument<TSchema>,
    options?: { }
}

export type InsertReturnType<TSchema extends Document> = InsertOneResult<TSchema>;

const payloadOptionsSchema: z.ZodType<InsertPayload<Document>["options"]> = z.object({
}).optional();

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: InsertAccessService, payload: InsertPayload<TSchema>): Promise<InsertReturnType<TSchema>> {
    // Validate the options payload
    payloadOptionsSchema.parse(payload.options);

    const { acknowledged, insertedIds } = await insert(collection, accessService, {
        documents: [payload.document],
        options: payload.options
    });

    return { acknowledged, insertedId: insertedIds[0] };
}