import type { FindOnePayload, Document, FindOneReturnType, Operation, FindPayload, FindReturnType, AggregatePayload, AggregateReturnType, DeleteOnePayload, DeleteOneReturnType, DeleteManyPayload, DeleteManyReturnType, InsertOnePayload, InsertOneReturnType, InsertManyReturnType, InsertManyPayload, UpdateOnePayload, UpdateOneReturnType, UpdateManyPayload, UpdateManyReturnType, FindOneAndUpdatePayload, FindOneAndUpdateReturnType } from "@mongalayer/server/client";
import { parseReviver, stringifyReplacer } from "@mongalayer/core/utils/json";
import { Db } from "./db";
import { MongalayerAPIError } from "./error";
import { MongalayerError } from "@mongalayer/core";

export class Collection {
    constructor (
        public name: string,
        public db: Db
    ) {
        
    }

    private async request (action: Operation, payload: any): Promise<any> {
        const url = this.db.client.options.format === "routed" 
            ? `${this.db.client.endpoint}/${this.db.name}/${this.name}/${action}` 
            : this.db.client.endpoint;
        
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
                const mongalayerErrorRegex = new RegExp(`"name":"MongalayerError"`);
                if (mongalayerErrorRegex.test(responseText)) {
                    throw MongalayerError.ServerError.fromJSON(responseText);
                } else {
                    throw new MongalayerAPIError(response.status, responseText);
                }
            }
        } catch (e) {
            if (e instanceof MongalayerAPIError || e instanceof MongalayerError.ServerError) {
                throw e;
            }

            throw new Error("Failed to fetch", { cause: e });
        }
    }

    public async findOne <TSchema extends Document> (filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"]): Promise<FindOneReturnType<TSchema>> {
        return await this.request("findOne", { filter, options });
    }

    public async find <TSchema extends Document> (filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"]): Promise<FindReturnType<TSchema>> {
        return await this.request("find", { filter, options });
    }

    public async findOneAndUpdate <TSchema extends Document> (filter: FindOneAndUpdatePayload<TSchema>["filter"], update: FindOneAndUpdatePayload<TSchema>["update"], options?: FindOneAndUpdatePayload<TSchema>["options"]): Promise<FindOneAndUpdateReturnType<TSchema>> {
        return await this.request("findOneAndUpdate", { filter, update, options });
    }

    public async aggregate <TSchema extends Document> (pipeline: AggregatePayload["pipeline"], options?: AggregatePayload["options"]): Promise<AggregateReturnType<TSchema>> {
        return await this.request("aggregate", { pipeline, options });
    }

    public async insertOne <TSchema extends Document> (document: TSchema, options?: InsertOnePayload<TSchema>["options"]): Promise<InsertOneReturnType<TSchema>> {
        return await this.request("insertOne", { document, options });
    }

    public async insertMany <TSchema extends Document> (documents: TSchema[], options?: InsertManyPayload<TSchema>["options"]): Promise<InsertManyReturnType<TSchema>> {
        return await this.request("insertMany", { documents, options });
    }

    public async updateOne <TSchema extends Document> (filter: UpdateOnePayload<TSchema>["filter"], update: UpdateOnePayload<TSchema>["update"], options?: UpdateOnePayload<TSchema>["options"]): Promise<UpdateOneReturnType<TSchema>> {
        return await this.request("updateOne", { filter, update, options });
    }

    public async updateMany <TSchema extends Document> (filter: UpdateManyPayload<TSchema>["filter"], update: UpdateManyPayload<TSchema>["update"], options?: UpdateManyPayload<TSchema>["options"]): Promise<UpdateManyReturnType<TSchema>> {
        return await this.request("updateMany", { filter, update, options });
    }

    public async deleteOne <TSchema extends Document> (filter: DeleteOnePayload<TSchema>["filter"], options?: DeleteOnePayload<TSchema>["options"]): Promise<DeleteOneReturnType> {
        return await this.request("deleteOne", { filter, options });
    }

    public async deleteMany <TSchema extends Document> (filter: DeleteManyPayload<TSchema>["filter"], options?: DeleteManyPayload<TSchema>["options"]): Promise<DeleteManyReturnType> {
        return await this.request("deleteMany", { filter, options });
    }
}