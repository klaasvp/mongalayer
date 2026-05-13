import { Client } from "./client.js";
import { Collection } from "./collection.js";

export class Db {
    constructor (
        public name: string,
        public client: Client
    ) {

    }

    public collection (collectionName: string) {
        return new Collection(collectionName, this);
    }
}