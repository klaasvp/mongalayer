import { MongoClient, Document, Db, ClientSession } from "mongodb";
import { ZodObject, ZodType } from "zod/v4";
import { Action, find, findOne, InferActionPayload, InferActionReturnType } from "./actions/index.js";
import { AccessConfig, AccessFieldPermission, AccessFieldPermissions, AccessPayload } from "./access.js";
import z from "zod/v4";
import { FindOneReturnType } from "./actions/findOne.js";
import { FindReturnType } from "./actions/find.js";
import { QueryService } from "./query.js";
import { parseReviver, stringifyReplacer } from "@mongalayer/core/utils/json"

export type MongalayerCollection<TSchema extends Document = Document> = {
    schema: ZodObject,
    access: AccessConfig<TSchema>
}

export type MongalayerCollections = Record<string, MongalayerCollection<Document>>;

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
    /**
     * @description Default access field permission for all fields not explicitly defined in the access config. 
     * @default {AccessFieldPermissions.Read}
     */
    accessFieldsDefault: AccessFieldPermission
};

export class Mongalayer {
    private options: MongalayerOptions;

    constructor (
        private mongodbClient: MongoClient,
        private collections: MongalayerCollections,
        providedOptions?: Partial<MongalayerOptions>
    ) { 
        this.options = {
            useSessions: true,
            debugging: false,
            accessFieldsDefault: AccessFieldPermissions.Read,
            ...providedOptions
        };
    }

    /**
     * This function uses currying to be able to provide the correct return types using Generics.
     */
    public async executeRaw <TAction extends Action>(action: TAction, actionPayload: InferActionPayload<TAction>, accessPayload: AccessPayload): Promise<InferActionReturnType<TAction>> {
        let result: FindOneReturnType<Document> | FindReturnType<Document> | void,
            database: Db | null, 
            session: ClientSession | null = null;

        try {
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
                console.debug("Mongalayer - Execute - No config found, using public access");
            }

            const accessService = new QueryService(accessPayload, accessConfig, schema, this.options.accessFieldsDefault);

            try {
                switch (action.operation) {
                    case "findOne": result = await findOne(collection, accessService, actionPayload); break;
                    case "find": result = await find(collection, accessService, actionPayload); break;
                }
            } catch (e) {
                if (e instanceof z.ZodError) {
                    if (this.options.debugging) {
                        throw e;
                    } else {
                        console.log(z.prettifyError(e));
                        // TODO: Added a nice error to report to the client (without exposing the schema)
                        throw "Validation error";
                    }
                } else {
                    throw e;
                }
            }
        }  finally {
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