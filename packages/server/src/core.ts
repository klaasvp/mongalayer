import type { MongoClient, Document, Db, ClientSession, MongoServerError } from "mongodb";
import { ZodObject, ZodType } from "zod";
import { Action, find, findOne, findOneAndUpdate, aggregate, deleteOne, InferActionPayload, InferActionReturnType, deleteMany, insertOne, insertMany, updateOne, updateMany, validateAction, actionSchema, operationSchema } from "./actions/index.js";
import { AccessConfig, AccessDefaults, AccessPermissions, AccessPayload } from "./access.js";
import z from "zod";
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

export type MongalayerCollection<TSchema extends Document, TAccessPayload extends AccessPayload = AccessPayload> = {
    schema: ZodObject,
    access: AccessConfig<TSchema, TAccessPayload>
}

export type MongalayerCollections<TAccessPayload extends AccessPayload = AccessPayload> = Record<string, MongalayerCollection<any, TAccessPayload>>;

export type MongalayerOptions = {
    /**
     * @description Enable MongoDB sessions for transactions.
     * @default true
     */
    //useSessions: boolean,
    /**
     * @description Enable debugging mode. This will log all actions to the console.
     * @default false
     */
    debugging: boolean,
    accessDefaults: AccessDefaults
};

export class Debugging {
    static isEnabled(): boolean {
        // @ts-ignore
        return process.env.MONGALAYER_DEBUG === "1";
    }
}

const bodySchema = z.strictObject({
    action: actionSchema,
    payload: z.record(z.string(), z.unknown())
});

const batchBodySchema = z.array(z.strictObject({
    action: z.strictObject({
        ...actionSchema.shape,
        operation: operationSchema.extract(["findOne", "find", "aggregate"])
    }),
    payload: z.record(z.string(), z.unknown())
}));

const parsedBodySchema = z.union([bodySchema, batchBodySchema]);

type ExecuteOptions = {
    validateAction?: boolean
}

export class Mongalayer<TAccessPayload extends AccessPayload = AccessPayload> {
    private options: MongalayerOptions;

    constructor (
        private mongodbClient: MongoClient,
        private collections: MongalayerCollections<TAccessPayload>,
        providedOptions?: PartialDeep<MongalayerOptions>
    ) { 
        this.options = {
            //useSessions: true,
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
                // @ts-ignore
                process.env.MONGALAYER_DEBUG = "1";
            } catch (e) {
                console.log("Mongalayer - Unable to set MONGALAYER_DEBUG environment variable");
            }
        } else if (Debugging.isEnabled()) {
            console.debug("Mongalayer - Debugging mode disabled");

            try {
                // @ts-ignore
                delete process.env.MONGALAYER_DEBUG;
            } catch (e) {
                console.log("Mongalayer - Unable to set MONGALAYER_DEBUG environment variable");
            }
        }
    }

    /**
     * This function uses currying to be able to provide the correct return types using Generics.
     */
    private async executeAction<TAction extends Action>(rawAction: TAction, actionPayload: InferActionPayload<TAction>, accessPayload: AccessPayload, options: ExecuteOptions = {}): Promise<InferActionReturnType<TAction>> {
        let result: FindOneReturnType<Document> | FindReturnType<Document> | AggregateReturnType<Document> | void,
            database: Db | null, 
            session: ClientSession | null = null;

        try {
            const action = options.validateAction === false ? rawAction : validateAction(rawAction);

            database = this.mongodbClient.db(action.database);

            //if (this.options.useSessions) {
            //    session = this.mongodbClient.startSession()
            //};

            const collection = database.collection(action.collection);

            let accessConfig: AccessConfig<Document, AccessPayload> = [], schema: ZodObject = z.object({});

            if (this.collections[action.collection] !== void 0) {
                accessConfig = this.collections[action.collection].access as AccessConfig<Document, AccessPayload>;
                schema = this.collections[action.collection].schema;
            } else {
                if (Debugging.isEnabled()) {
                    console.debug("Mongalayer - Execute - No config found, using public access");
                }
            }

            let accessService: QueryAccessService | AggregationAccessService<TAccessPayload> | InsertAccessService | UpdateAccessService | DeleteAccessService;

            switch (action.operation) {
                case "findOne":
                case "find": 
                    accessService = new QueryAccessService(this.mongodbClient, action.database, action.collection, accessPayload, accessConfig, schema, this.options.accessDefaults);
                    break;
                case "aggregate":
                    accessService = new AggregationAccessService<TAccessPayload>(this.mongodbClient, action.database, action.collection, accessPayload as TAccessPayload, accessConfig, schema, this.options.accessDefaults, this.collections);
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
                    case "findOne": result = await findOne(database, accessService as QueryAccessService, actionPayload as FindOnePayload<Document>); break;
                    case "find": result = await find(database, accessService as QueryAccessService, actionPayload as FindPayload<Document>); break;
                    case "findOneAndUpdate": result = await findOneAndUpdate(database, accessService as UpdateAccessService, actionPayload as FindOneAndUpdatePayload<Document>); break;
                    case "aggregate": result = await aggregate(database, accessService as AggregationAccessService, actionPayload as AggregatePayload); break;
                    case "insertOne": result = await insertOne(database, accessService as InsertAccessService, actionPayload as InsertOnePayload<Document>); break;
                    case "insertMany": result = await insertMany(database, accessService as InsertAccessService, actionPayload as InsertManyPayload<Document>); break;
                    case "updateOne": result = await updateOne(database, accessService as UpdateAccessService, actionPayload as UpdateOnePayload<Document>); break;
                    case "updateMany": result = await updateMany(database, accessService as UpdateAccessService, actionPayload as UpdateManyPayload<Document>); break;
                    case "deleteOne": result = await deleteOne(database, accessService as DeleteAccessService, actionPayload as DeleteOnePayload<Document>); break;
                    case "deleteMany": result = await deleteMany(database, accessService as DeleteAccessService, actionPayload as DeleteManyPayload<Document>); break;
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

            //if (this.options.useSessions && session) {
            //    await session.endSession();
            //}
        }

        return result as InferActionReturnType<TAction>;
    }

    public async executeRaw <TAction extends Action>(rawAction: TAction, actionPayload: InferActionPayload<TAction>, accessPayload: AccessPayload) {
        return this.executeAction(rawAction, actionPayload, accessPayload);
    }

    public async execute <TAction extends Action>(action: TAction, stringifiedActionPayload: string, accessPayload: AccessPayload): Promise<string> {
        const actionPayload: InferActionPayload<TAction> = JSON.parse(stringifiedActionPayload, parseReviver);

        const result = await this.executeRaw(action, actionPayload, accessPayload);
        
        return JSON.stringify(result, stringifyReplacer);
    }

    public async executeJSON (stringifiedBody: string, accessPayload: AccessPayload): Promise<string> {
        const parsedBody = JSON.parse(stringifiedBody, parseReviver);

        try {
            // This will validate the action part not the payload part, that's done by the access services when they execute the action
            const body = parsedBodySchema.parse(parsedBody) as { action: Action, payload: any } | { action: Action, payload: any }[];

            const result = Array.isArray(body) 
                ? await Promise.all(body.map(({ action, payload }) => this.executeAction(action, payload, accessPayload, { validateAction: false })))
                : await this.executeAction(body.action, body.payload, accessPayload, { validateAction: false });

            return JSON.stringify(result, stringifyReplacer);
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
        }
    }
}