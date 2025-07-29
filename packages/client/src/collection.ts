import { FindOnePayload, Document, FindOneReturnType, Operation, FindPayload, FindReturnType } from "@mongalayer/server/client";
import { Db } from "./db";

export class Collection {
    constructor (
        public name: string,
        public db: Db
    ) {
        
    }

    private async request (action: Operation, payload: any): Promise<Response> {
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
            body: JSON.stringify(body)
        }

        if (this.db.client.options.headers !== void 0) requestInit.headers = this.db.client.options.headers;
        if (this.db.client.options.credentials !== void 0) requestInit.credentials = this.db.client.options.credentials;

        const request = fetch(url, requestInit);

        try {
            return await request;
        } catch (e) {
            throw new Error("Failed to fetch", { cause: e });
        }
    }

    public async findOne <TSchema extends Document> (filter: FindOnePayload<TSchema>["filter"], options?: FindOnePayload<TSchema>["options"]): Promise<FindOneReturnType<TSchema>> {
        const response = await this.request("findOne", { filter, options });

        return response.json();
    }

    public async find <TSchema extends Document> (filter: FindPayload<TSchema>["filter"], options?: FindPayload<TSchema>["options"]): Promise<FindReturnType<TSchema>> {
        const response = await this.request("find", { filter, options });

        return response.json();
    }
}