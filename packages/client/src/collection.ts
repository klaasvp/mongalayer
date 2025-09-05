import { FindOnePayload, Document, FindOneReturnType, Operation, FindPayload, FindReturnType, AggregatePayload, AggregateReturnType     } from "@mongalayer/server/client";
import { parseReviver, stringifyReplacer } from "@mongalayer/core/utils/json";
import { Db } from "./db";

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

        if (this.db.client.options.headers !== void 0) requestInit.headers = this.db.client.options.headers;
        if (this.db.client.options.credentials !== void 0) requestInit.credentials = this.db.client.options.credentials;

        const request = fetch(url, requestInit);

        try {
            const response = await request;

            const jsonString = await response.text();

            return JSON.parse(jsonString, parseReviver);
        } catch (e) {
            throw new Error("Failed to fetch", { cause: e });
        }
    }

    public async findOne <TSchema extends Document> (filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"]): Promise<FindOneReturnType<TSchema>> {
        return await this.request("findOne", { filter, options });
    }

    public async find <TSchema extends Document> (filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"]): Promise<FindReturnType<TSchema>> {
        return await this.request("find", { filter, options });
    }

    public async aggregate <TSchema extends Document> (pipeline: AggregatePayload["pipeline"], options?: AggregatePayload["options"]): Promise<AggregateReturnType<TSchema>> {
        return await this.request("aggregate", { pipeline, options });
    }
}