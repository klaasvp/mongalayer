import type { Document } from "mongodb";
import { Client } from "./client.js";
import { Collection, CollectionName } from "./collection.js";
import { request } from "./request.js";
import { BatchOperation, BatchOperationReturnType } from "./batch.js";

export class Db {
    constructor (
        public name: string,
        public client: Client
    ) {

    }

    public collection<TSchema extends Document> (collectionName: CollectionName<TSchema>) {
        return new Collection<TSchema>(collectionName, this);
    }

    public async batch <TBatch extends [BatchOperation, ...BatchOperation[]]>(batchOperations: TBatch, context?: any): Promise<{
        [K in keyof TBatch]: TBatch[K] extends BatchOperation<infer TSchema, infer TOperation>
            ? BatchOperationReturnType<TOperation, TSchema>
            : never
    }> {
        if (this.client.options.format === "routed") {
            throw new Error("Batch operations are not supported in routed format");
        }

        const url = new URL(this.client.endpoint);

        const body = batchOperations.map(batchOperation => ({
            action: {
                database: this.name,
                collection: batchOperation.collection,
                operation: batchOperation.operation
            },
            payload: batchOperation.payload
        }));

        return await request(url, body, this.client.options, context);
    }
}