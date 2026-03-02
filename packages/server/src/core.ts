import type { MongoClient, Document, Db, ClientSession, MongoServerError } from "mongodb";
import { ZodObject, ZodType } from "zod/v4";
import { Action, find, findOne, findOneAndUpdate, aggregate, deleteOne, InferActionPayload, InferActionReturnType, deleteMany, insertOne, insertMany, updateOne, updateMany, validateAction } from "./actions/index.js";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessPayload } from "./access.js";
import z from "zod/v4";
import { FindOnePayload, FindOneReturnType } from "./actions/findOne.js";
import { FindPayload, FindReturnType } from "./actions/find.js";
import { FindOneAndUpdatePayload } from "./actions/findOneAndUpdate.js";
import { InsertOnePayload } from "./actions/insertOne.js";
import { InsertManyPayload } from "./actions/insertMany.js";
import { UpdateOnePayload } from "./actions/updateOne.js";
import { UpdateManyPayload } from "./actions/updateMany.js";
import { DatabaseError, parseReviver, stringifyReplacer, ValidationError } from "@mongalayer/core"
import { AggregatePayload, AggregateReturnType } from "./actions/aggregate.js";
import { QueryAccessService } from "./access/query.js";
import { AggregationAccessService } from "./access/aggregation.js";
import { DeleteOnePayload } from "./actions/deleteOne.js";
import { DeleteAccessService } from "./access/delete.js";
import { PartialDeep } from "type-fest";
import { DeleteManyPayload } from "./actions/deleteMany.js";
import { InsertAccessService } from "./access/insert.js";
import { UpdateAccessService } from "./access/update.js";
import {  } from "@mongalayer/core";

export { validateAction } from "./actions/index.js";

export type MongalayerCollection<TSchema extends Document> = {
    schema: ZodObject,
    access: AccessConfig<TSchema>
}

export type MongalayerCollections = Record<string, MongalayerCollection<any>>;

export type MongalayerOptions = {
    /**
     * @description Enable MongoDB sessions for transactions.
     * @default true
     */
    useSessions: boolean,
    /**
     * @description Enable debugging mode. This will log all actions to the console.
     * @default false
     */
    debugging: boolean,
    accessDefaults: AccessDefaults
};

export class Debugging {
    static isEnabled(): boolean {
        return process.env.MONGALAYER_DEBUG === "1";
    }
}

export class Mongalayer {
    private options: MongalayerOptions;

    constructor (
        private mongodbClient: MongoClient,
        private collections: MongalayerCollections,
        providedOptions?: PartialDeep<MongalayerOptions>
    ) { 
        this.options = {
            useSessions: true,
            debugging: false,
            ...providedOptions,
            accessDefaults: {
                document: AccessPermissions.Read,
                delete: false,
                ...providedOptions?.accessDefaults ?? { }
            }
        };

        if (this.options.debugging) {
            console.debug("Mongalayer - Debugging mode enabled");

            try {
                process.env.MONGALAYER_DEBUG = "1";
            } catch (e) {
                console.log("Mongalayer - Unable to set MONGALAYER_DEBUG environment variable");
            }
        } else if (Debugging.isEnabled()) {
            console.debug("Mongalayer - Debugging mode disabled");

            try {
                delete process.env.MONGALAYER_DEBUG;
            } catch (e) {
                console.log("Mongalayer - Unable to set MONGALAYER_DEBUG environment variable");
            }
        }
    }

    /**
     * This function uses currying to be able to provide the correct return types using Generics.
     */
    public async executeRaw <TAction extends Action>(rawAction: TAction, actionPayload: InferActionPayload<TAction>, accessPayload: AccessPayload): Promise<InferActionReturnType<TAction>> {
        let result: FindOneReturnType<Document> | FindReturnType<Document> | AggregateReturnType<Document> | void,
            database: Db | null, 
            session: ClientSession | null = null;

        try {
            const action = validateAction(rawAction);

            database = this.mongodbClient.db(action.database);

            if (this.options.useSessions) {
                session = this.mongodbClient.startSession()
            };

            const collection = database.collection(action.collection);

            let accessConfig: AccessConfig<Document> = [], schema: ZodObject = z.object({});

            if (this.collections[action.collection] !== void 0) {
                accessConfig = this.collections[action.collection].access;
                schema = this.collections[action.collection].schema;
            } else {
                if (Debugging.isEnabled()) {
                    console.debug("Mongalayer - Execute - No config found, using public access");
                }
            }

            let accessService: QueryAccessService | AggregationAccessService | InsertAccessService | UpdateAccessService | DeleteAccessService;

            switch (action.operation) {
                case "findOne":
                case "find": 
                    accessService = new QueryAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
                case "aggregate":
                    accessService = new AggregationAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
                case "insertOne":
                case "insertMany":
                    accessService = new InsertAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
                case "updateOne":
                case "updateMany":
                case "findOneAndUpdate":
                    accessService = new UpdateAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
                case "deleteOne":
                case "deleteMany":
                    accessService = new DeleteAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
            }

            try {
                switch (action.operation) {
                    case "findOne": result = await findOne(collection, accessService as QueryAccessService, actionPayload as FindOnePayload<Document>); break;
                    case "find": result = await find(collection, accessService as QueryAccessService, actionPayload as FindPayload<Document>); break;
                    case "findOneAndUpdate": result = await findOneAndUpdate(collection, accessService as UpdateAccessService, actionPayload as FindOneAndUpdatePayload<Document>); break;
                    case "aggregate": result = await aggregate(collection, accessService as AggregationAccessService, actionPayload as AggregatePayload); break;
                    case "insertOne": result = await insertOne(collection, accessService as InsertAccessService, actionPayload as InsertOnePayload<Document>); break;
                    case "insertMany": result = await insertMany(collection, accessService as InsertAccessService, actionPayload as InsertManyPayload<Document>); break;
                    case "updateOne": result = await updateOne(collection, accessService as UpdateAccessService, actionPayload as UpdateOnePayload<Document>); break;
                    case "updateMany": result = await updateMany(collection, accessService as UpdateAccessService, actionPayload as UpdateManyPayload<Document>); break;
                    case "deleteOne": result = await deleteOne(collection, accessService as DeleteAccessService, actionPayload as DeleteOnePayload<Document>); break;
                    case "deleteMany": result = await deleteMany(collection, accessService as DeleteAccessService, actionPayload as DeleteManyPayload<Document>); break;
                }
            } catch (e) {
                if (e instanceof z.ZodError) {
                    if (Debugging.isEnabled()) {
                        throw e;
                    } else {
                        console.log(z.prettifyError(e));
                        
                        throw new ValidationError("Failed to validate action payload");
                    }
                } else if (e instanceof Error && /^Mongo/.test(e.name)) { // MongoServerError don't use this class as we only want to use types
                    if (Debugging.isEnabled()) {
                        throw e;
                    } else {
                        throw DatabaseError.buildFromMongoError(e);
                    }
                } else {
                    throw e;
                }
            }
        } catch (e) {
            if (e instanceof z.ZodError) {
                if (Debugging.isEnabled()) {
                    throw e;
                } else {
                    console.log(z.prettifyError(e));
                    
                    throw new ValidationError("Failed to validate action parameters");
                }
            } else {
                throw e;
            }
        } finally {
            database = null;

            if (this.options.useSessions && session) {
                await session.endSession();
            }
        }

        return result as InferActionReturnType<TAction>;
    }

    public async execute <TAction extends Action>(action: TAction, stringifiedActionPayload: string, accessPayload: AccessPayload): Promise<string> {
        const actionPayload: InferActionPayload<TAction> = JSON.parse(stringifiedActionPayload, parseReviver);

        const result = await this.executeRaw(action, actionPayload, accessPayload);
        
        return JSON.stringify(result, stringifyReplacer);
    }
}