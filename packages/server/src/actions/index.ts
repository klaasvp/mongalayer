import { Document } from "mongodb"
import find, { FindPayload } from "./find.js"
import findOne, { FindOnePayload } from "./findOne.js"

export type Operation = "findOne" | "find"

export type Action<TSchema extends Document, TOperation extends Operation = Operation> = {
    database: string,
    collection: string,
    operation: TOperation,
    payload: 
        TOperation extends "findOne" ? FindOnePayload<TSchema> : 
        TOperation extends "find" ? FindPayload<TSchema> :
        never
}

export type * from "./types.js";

export {
    find,
    findOne
}