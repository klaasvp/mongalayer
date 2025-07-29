import { Client } from "./client";
import { Collection } from "./collection";

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