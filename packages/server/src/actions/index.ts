import type { Document } from "mongodb"
import find, { FindPayload, FindReturnType } from "./find.js"
import findOne, { FindOnePayload, FindOneReturnType } from "./findOne.js"
import findOneAndUpdate, { FindOneAndUpdatePayload, FindOneAndUpdateReturnType } from "./findOneAndUpdate.js"
import aggregate, { AggregatePayload, AggregateReturnType } from "./aggregate.js";
import deleteOne, { DeleteOnePayload, DeleteOneReturnType } from "./deleteOne.js";
import deleteMany, { DeleteManyPayload, DeleteManyReturnType } from "./deleteMany.js";
import insertOne, { InsertOnePayload, InsertOneReturnType } from "./insertOne.js";
import insertMany, { InsertManyPayload, InsertManyReturnType } from "./insertMany.js";
import updateOne, { UpdateOnePayload, UpdateOneReturnType } from "./updateOne.js";
import updateMany, { UpdateManyPayload, UpdateManyReturnType } from "./updateMany.js";

export type Operation = 
    | "findOne" 
    | "find" 
    | "findOneAndUpdate" 
    /** When using AccessDefinition make sure to add a $sort stage as the results order will be by role  */
    | "aggregate"
    | "insertOne"
    | "insertMany"
    | "updateOne"
    | "updateMany"
    | "deleteOne"
    | "deleteMany";

export type Action<TCollection extends MongalayerCollectionType = MongalayerCollectionType, TOperation extends Operation = Operation> = {
    database: string,
    collection: TCollection,
    operation: TOperation
}

export type InferActionPayload<TAction extends Action> = TAction extends { operation: infer TOperation, collection: infer TCollection }  ? 
    TOperation extends "findOne" ? FindOnePayload<GetCollectionSchema<TCollection>> : 
    TOperation extends "find" ? FindPayload<GetCollectionSchema<TCollection>> :
    TOperation extends "findOneAndUpdate" ? FindOneAndUpdatePayload<GetCollectionSchema<TCollection>> :
    TOperation extends "aggregate" ? AggregatePayload :
    TOperation extends "insertOne" ? InsertOnePayload<GetCollectionSchema<TCollection>> :
    TOperation extends "insertMany" ? InsertManyPayload<GetCollectionSchema<TCollection>> :
    TOperation extends "updateOne" ? UpdateOnePayload<GetCollectionSchema<TCollection>> :
    TOperation extends "updateMany" ? UpdateManyPayload<GetCollectionSchema<TCollection>> :
    TOperation extends "deleteOne" ? DeleteOnePayload<GetCollectionSchema<TCollection>> :
    TOperation extends "deleteMany" ? DeleteManyPayload<GetCollectionSchema<TCollection>> :
    never : never;

export type InferActionReturnType<TAction extends Action> = TAction extends { operation: infer TOperation, collection: infer TCollection }  ? 
    TOperation extends "findOne" ? FindOneReturnType<GetCollectionSchema<TCollection>> : 
    TOperation extends "find" ? FindReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "findOneAndUpdate" ? FindOneAndUpdateReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "aggregate" ? AggregateReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "insertOne" ? InsertOneReturnType<GetCollectionSchema<TCollection>> : 
    TOperation extends "insertMany" ? InsertManyReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "updateOne" ? UpdateOneReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "updateMany" ? UpdateManyReturnType<GetCollectionSchema<TCollection>> :
    TOperation extends "deleteOne" ? DeleteOneReturnType :
    TOperation extends "deleteMany" ? DeleteManyReturnType :
    never : never;

export type MongalayerCollectionType <TSchema extends Document = Document> = string & {
  __schema?: TSchema;
};

type GetCollectionSchema<T> = T extends MongalayerCollectionType<infer U> ? U : never;

export type * from "./types.js";

export {
    find,
    findOne,
    findOneAndUpdate,
    aggregate,
    insertOne,
    insertMany,
    updateOne,
    updateMany,
    deleteOne,
    deleteMany
}