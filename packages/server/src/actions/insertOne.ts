import type { Collection, Db, Document, InsertOneResult } from "mongodb";
import z from "zod";
import { InsertableDocument, InsertAccessService } from "../access/insert.js";
import insert from "./insertMany.js";
import { Debugging } from "../core.js";

export type InsertOnePayload <TSchema extends Document> = {
    document: InsertableDocument<TSchema>,
    options?: { }
}

export type InsertOneReturnType<TSchema extends Document> = InsertOneResult<TSchema>;

const payloadOptionsSchema: z.ZodType<InsertOnePayload<Document>["options"]> = z.object({
}).optional();

export default async function <TSchema extends Document> (database: Db, accessService: InsertAccessService, payload: InsertOnePayload<TSchema>): Promise<InsertOneReturnType<TSchema>> {
    // Validate the options payload
    payloadOptionsSchema.parse(payload.options);

    const { acknowledged, insertedIds } = await insert(database, accessService, {
        documents: [payload.document],
        options: payload.options
    });

    return { acknowledged, insertedId: insertedIds[0] };
}