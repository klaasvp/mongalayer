import { Db } from "./db";

type RequestFormat = "routed" | "json";

export type ClientOptions = {
    format: RequestFormat,
    headers?: RequestInit["headers"],
    credentials?: RequestInit["credentials"]
}

export class Client {
    public readonly options: ClientOptions;

    constructor (public readonly endpoint: string, options?: Partial<ClientOptions>) {
        this.options = {
            format: "json",
            ...options
        }
    }

    public db (dbName: string) {
        return new Db(dbName, this);
    }
}