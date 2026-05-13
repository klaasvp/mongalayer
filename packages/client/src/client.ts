import { Db } from "./db.js";

type RequestFormat = "routed" | "json";

type RequestHeaders = RequestInit["headers"] | (() => RequestInit["headers"]) | (() => Promise<RequestInit["headers"]>);

export type ClientOptions = {
    format: RequestFormat,
    headers?: RequestHeaders,
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

    public setFormat (format: RequestFormat) {
        this.options.format = format;
    }

    public setHeaders (headers: RequestHeaders) {
        this.options.headers = headers;
    }

    public setCredentials (credentials: RequestInit["credentials"]) {
        this.options.credentials = credentials;
    }
}