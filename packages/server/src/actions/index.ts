import { Document } from "mongodb"
import find, { FindPayload, FindReturnType } from "./find.js"
import findOne, { FindOnePayload, FindOneReturnType } from "./findOne.js"
import aggregate, { AggregatePayload, AggregateReturnType } from "./aggregate.js";

export type Operation = 
    | "findOne" 
    | "find" 
    /** When using AccessDefinition make sure to add a $sort stage as the results order will be by role  */
    | "aggregate";

export type Action<TCollection extends MongalayerCollectionType = MongalayerCollectionType, TOperation extends Operation = Operation> = {
    database: string,
    collection: TCollection,
    operation: TOperation
}

export type InferActionPayload<TAction extends Action> = TAction extends { operation: infer TOperation, collection: infer TCollection }  ? 
    TOperation extends "findOne" ? FindOnePayload<GetCollectionSchema<TCollection>> : 
    TOperation extends "find" ? FindPayload<GetCollectionSchema<TCollection>> :
    TOperation extends "aggregate" ? AggregatePayload :
    never : never;

export type InferActionReturnType<TAction extends Action> = TAction extends { operation: infer TOperation, collection: infer TCollection }  ? 
    TOperation extends "findOne" ? FindOneReturnType<GetCollectionSchema<TCollection>> : 
    TOperation extends "find" ? FindReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "aggregate" ? AggregateReturnType<GetCollectionSchema<TCollection>> :
    never : never;

export type MongalayerCollectionType <TSchema extends Document = Document> = string & {
  __schema?: TSchema;
};

type GetCollectionSchema<T> = T extends MongalayerCollectionType<infer U> ? U : never;

export type * from "./types.js";

export {
    find,
    findOne,
    aggregate
}