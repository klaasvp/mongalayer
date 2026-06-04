import type { FindOnePayload, Document, FindOneReturnType, Operation, FindPayload, FindReturnType, AggregatePayload, AggregateReturnType, DeleteOnePayload, DeleteOneReturnType, DeleteManyPayload, DeleteManyReturnType, InsertOnePayload, InsertOneReturnType, InsertManyReturnType, InsertManyPayload, UpdateOnePayload, UpdateOneReturnType, UpdateManyPayload, UpdateManyReturnType, FindOneAndUpdatePayload, FindOneAndUpdateReturnType } from "@mongalayer/server/client";
import { Db } from "./db.js";
import { request } from "./request.js";

export type CollectionName<TSchema extends Document = Document> = string & {
    __schema?: TSchema;
};

type GetCollectionSchema<T> = T extends CollectionName<infer U> ? U : never;

export class Collection<TSchema extends Document> {
    constructor (
        public name: CollectionName<TSchema>,
        public db: Db
    ) {
        
    }

    private async request (action: Operation, payload: any, context?: any): Promise<any> {
        const url = new URL(this.db.client.options.format === "routed" 
            ? `${this.db.client.endpoint}/${this.db.name}/${this.name}/${action}` 
            : this.db.client.endpoint);

        const body = this.db.client.options.format === "routed" 
            ? payload 
            : {
                action: {
                    database: this.db.name,
                    collection: this.name,
                    operation: action
                },
                payload
            };

        return await request(url, body, this.db.client.options, context);
    }

    public async findOne (filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"], context?: any): Promise<FindOneReturnType<TSchema>> {
        return await this.request("findOne", { filter, options }, context);
    }

    public async find (filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"], context?: any): Promise<FindReturnType<TSchema>> {
        return await this.request("find", { filter, options }, context);
    }

    public async findOneAndUpdate (filter: FindOneAndUpdatePayload<TSchema>["filter"], update: FindOneAndUpdatePayload<TSchema>["update"], options?: FindOneAndUpdatePayload<TSchema>["options"], context?: any): Promise<FindOneAndUpdateReturnType<TSchema>> {
        return await this.request("findOneAndUpdate", { filter, update, options }, context);
    }

    public async aggregate (pipeline: AggregatePayload["pipeline"], options?: AggregatePayload["options"], context?: any): Promise<AggregateReturnType<TSchema>> {
        return await this.request("aggregate", { pipeline, options }, context);
    }

    public async insertOne (document: TSchema, options?: InsertOnePayload<TSchema>["options"], context?: any): Promise<InsertOneReturnType<TSchema>> {
        return await this.request("insertOne", { document, options }, context);
    }

    public async insertMany (documents: TSchema[], options?: InsertManyPayload<TSchema>["options"], context?: any): Promise<InsertManyReturnType<TSchema>> {
        return await this.request("insertMany", { documents, options }, context);
    }

    public async updateOne (filter: UpdateOnePayload<TSchema>["filter"], update: UpdateOnePayload<TSchema>["update"], options?: UpdateOnePayload<TSchema>["options"], context?: any): Promise<UpdateOneReturnType<TSchema>> {
        return await this.request("updateOne", { filter, update, options }, context);
    }

    public async updateMany (filter: UpdateManyPayload<TSchema>["filter"], update: UpdateManyPayload<TSchema>["update"], options?: UpdateManyPayload<TSchema>["options"], context?: any): Promise<UpdateManyReturnType<TSchema>> {
        return await this.request("updateMany", { filter, update, options }, context);
    }

    public async deleteOne (filter: DeleteOnePayload<TSchema>["filter"], options?: DeleteOnePayload<TSchema>["options"], context?: any): Promise<DeleteOneReturnType> {
        return await this.request("deleteOne", { filter, options }, context);
    }

    public async deleteMany (filter: DeleteManyPayload<TSchema>["filter"], options?: DeleteManyPayload<TSchema>["options"], context?: any): Promise<DeleteManyReturnType> {
        return await this.request("deleteMany", { filter, options }, context);
    }
}