import type { Document } from "mongodb";
import { Client } from "./client.js";
import { Collection } from "./collection.js";

export class Db {
    constructor (
        public name: string,
        public client: Client
    ) {

    }

    public collection<TSchema extends Document> (collectionName: string) {
        return new Collection<TSchema>(collectionName, this);
    }
}