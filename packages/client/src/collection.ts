import type { FindOnePayload, Document, FindOneReturnType, Operation, FindPayload, FindReturnType, AggregatePayload, AggregateReturnType, DeleteOnePayload, DeleteOneReturnType, DeleteManyPayload, DeleteManyReturnType, InsertOnePayload, InsertOneReturnType, InsertManyReturnType, InsertManyPayload, UpdateOnePayload, UpdateOneReturnType, UpdateManyPayload, UpdateManyReturnType, FindOneAndUpdatePayload, FindOneAndUpdateReturnType } from "@mongalayer/server/client";
import { Db } from "./db.js";
import { MongalayerAPIError } from "./error.js";
import { serverErrorName, ServerError,  parseReviver, stringifyReplacer } from "@mongalayer/core";

export class Collection {
    constructor (
        public name: string,
        public db: Db
    ) {
        
    }

    private async request (action: Operation, payload: any, context?: any): Promise<any> {
        const url = new URL(this.db.client.options.format === "routed" 
            ? `${this.db.client.endpoint}/${this.db.name}/${this.name}/${action}` 
            : this.db.client.endpoint);
        
        if (context !== void 0) {
            url.searchParams.append("context", btoa(JSON.stringify(context, stringifyReplacer)));
        }

        const body = this.db.client.options.format === "routed" 
            ? payload 
            : {
                action: {
                    database: this.db.name,
                    collection: this.name,
                    operation: action
                },
                payload
            }

        const requestInit: RequestInit = {
            method: "POST",
            body: JSON.stringify(body, stringifyReplacer)
        }

        if (this.db.client.options.headers !== void 0) requestInit.headers = this.db.client.options.headers instanceof Function ? await this.db.client.options.headers() : this.db.client.options.headers;
        if (this.db.client.options.credentials !== void 0) requestInit.credentials = this.db.client.options.credentials;

        const request = fetch(url, requestInit);

        try {
            const response = await request;
            const responseText = await response.text();

            if (response.ok) {
                return JSON.parse(responseText, parseReviver);
            } else {
                const mongalayerErrorRegex = new RegExp(`"name":"${serverErrorName}"`);
                if (mongalayerErrorRegex.test(responseText)) {
                    throw ServerError.fromJSON(responseText);
                } else {
                    throw new MongalayerAPIError(response.status, responseText);
                }
            }
        } catch (e) {
            if (e instanceof MongalayerAPIError || e instanceof ServerError) {
                throw e;
            }

            throw new Error("Failed to fetch", { cause: e });
        }
    }

    public async findOne <TSchema extends Document> (filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"], context?: any): Promise<FindOneReturnType<TSchema>> {
        return await this.request("findOne", { filter, options }, context);
    }

    public async find <TSchema extends Document> (filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"], context?: any): Promise<FindReturnType<TSchema>> {
        return await this.request("find", { filter, options }, context);
    }

    public async findOneAndUpdate <TSchema extends Document> (filter: FindOneAndUpdatePayload<TSchema>["filter"], update: FindOneAndUpdatePayload<TSchema>["update"], options?: FindOneAndUpdatePayload<TSchema>["options"], context?: any): Promise<FindOneAndUpdateReturnType<TSchema>> {
        return await this.request("findOneAndUpdate", { filter, update, options }, context);
    }

    public async aggregate <TSchema extends Document> (pipeline: AggregatePayload["pipeline"], options?: AggregatePayload["options"], context?: any): Promise<AggregateReturnType<TSchema>> {
        return await this.request("aggregate", { pipeline, options }, context);
    }

    public async insertOne <TSchema extends Document> (document: TSchema, options?: InsertOnePayload<TSchema>["options"], context?: any): Promise<InsertOneReturnType<TSchema>> {
        return await this.request("insertOne", { document, options }, context);
    }

    public async insertMany <TSchema extends Document> (documents: TSchema[], options?: InsertManyPayload<TSchema>["options"], context?: any): Promise<InsertManyReturnType<TSchema>> {
        return await this.request("insertMany", { documents, options }, context);
    }

    public async updateOne <TSchema extends Document> (filter: UpdateOnePayload<TSchema>["filter"], update: UpdateOnePayload<TSchema>["update"], options?: UpdateOnePayload<TSchema>["options"], context?: any): Promise<UpdateOneReturnType<TSchema>> {
        return await this.request("updateOne", { filter, update, options }, context);
    }

    public async updateMany <TSchema extends Document> (filter: UpdateManyPayload<TSchema>["filter"], update: UpdateManyPayload<TSchema>["update"], options?: UpdateManyPayload<TSchema>["options"], context?: any): Promise<UpdateManyReturnType<TSchema>> {
        return await this.request("updateMany", { filter, update, options }, context);
    }

    public async deleteOne <TSchema extends Document> (filter: DeleteOnePayload<TSchema>["filter"], options?: DeleteOnePayload<TSchema>["options"], context?: any): Promise<DeleteOneReturnType> {
        return await this.request("deleteOne", { filter, options }, context);
    }

    public async deleteMany <TSchema extends Document> (filter: DeleteManyPayload<TSchema>["filter"], options?: DeleteManyPayload<TSchema>["options"], context?: any): Promise<DeleteManyReturnType> {
        return await this.request("deleteMany", { filter, options }, context);
    }
}