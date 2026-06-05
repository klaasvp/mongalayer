import type { Document } from "mongodb";
import { Client } from "./client.js";
import { Collection, CollectionName, CollectionOptions } from "./collection.js";
import { request } from "./request.js";
import { BatchOperation, BatchOperationReturnType } from "./batch.js";

type BatchQueueItem = {
    batchOperation: BatchOperation,
    context?: any,
    resolve: (value: any) => void,
    reject: (reason?: any) => void
}

export class Db {
    private requestQueue: BatchQueueItem[] = [];
    private batchTimeout: number | null = null;

    constructor (
        public name: string,
        public client: Client
    ) {

    }

    public collection<TSchema extends Document> (collectionName: CollectionName<TSchema>, options: CollectionOptions = {}) {
        return new Collection<TSchema>(collectionName, this, options);
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

    public async autoBatch <TBatchOperation extends BatchOperation> (batchOperation: TBatchOperation, context?: any): Promise<TBatchOperation extends BatchOperation<infer TSchema, infer TOperation>
            ? BatchOperationReturnType<TOperation, TSchema>
            : never> {
        if (this.client.options.format === "routed") {
            throw new Error("Batch operations are not supported in routed format");
        }
        
        if (!this.client.options.autoBatch) {
            throw new Error("Auto batching is not enabled");
        }

        return new Promise((resolve, reject) => {
            this.requestQueue.push({ batchOperation, context, resolve, reject });

            if (this.batchTimeout === null) {
                this.batchTimeout = setTimeout(() => {
                    const queue = this.requestQueue.slice();

                    this.requestQueue = [];
                    this.batchTimeout = null;

                    this.executeBatch(queue);
                }, this.client.options.autoBatchDelay);
            }
        });
    }

    private async executeBatch(queue: BatchQueueItem[]) {
        if (queue.length === 0) {
            return;
        }

        const batchOperations = queue.map(item => item.batchOperation) as [BatchOperation, ...BatchOperation[]];
        const context = Object.assign({}, ...queue.map(item => item.context));

        try {
            const results = await this.batch(batchOperations, context);
            
            results.forEach((result, index) => {
                queue[index].resolve(result);
            });
        } catch (error) {
            queue.forEach(item => item.reject(error));
        }
    }
}
