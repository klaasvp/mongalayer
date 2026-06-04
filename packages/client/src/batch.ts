import type { Document } from "mongodb";
import { AggregatePayload, AggregateReturnType, FindOnePayload, FindOneReturnType, FindPayload, FindReturnType, Operation } from "@mongalayer/server/client";
import { CollectionName } from "./collection";

type SupportedBatchOperation = Extract<Operation, "findOne" | "find" | "aggregate">;

type BatchOperationPayload<TOperation extends SupportedBatchOperation, TSchema extends Document> =
    TOperation extends "findOne" ? { filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"] } :
    TOperation extends "find" ? { filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"] } :
    TOperation extends "aggregate" ? { pipeline: AggregatePayload["pipeline"], options?: AggregatePayload["options"] } :
    never;

export type BatchOperationReturnType<TOperation extends SupportedBatchOperation, TSchema extends Document> =
    TOperation extends "findOne" ? FindOneReturnType<TSchema> :
    TOperation extends "find" ? FindReturnType<TSchema> :
    TOperation extends "aggregate" ? AggregateReturnType<TSchema> :
    never;

export class BatchOperation<TSchema extends Document = Document, TOperation extends SupportedBatchOperation = SupportedBatchOperation> {
    constructor (
        public collection: CollectionName<TSchema>,
        public operation: TOperation,
        public payload: BatchOperationPayload<TOperation, TSchema>
    ) {}

    static findOne<TSchema extends Document> (collection: CollectionName<TSchema>, payload: BatchOperationPayload<"findOne", TSchema>): BatchOperation<TSchema, "findOne"> {
        return new BatchOperation(collection, "findOne", payload);
    }

    static find<TSchema extends Document> (collection: CollectionName<TSchema>, payload: BatchOperationPayload<"find", TSchema>): BatchOperation<TSchema, "find"> {
        return new BatchOperation(collection, "find", payload);
    }

    static aggregate<TSchema extends Document> (collection: CollectionName<TSchema>, payload: BatchOperationPayload<"aggregate", TSchema>): BatchOperation<TSchema, "aggregate"> {
        return new BatchOperation(collection, "aggregate", payload);
    }
}