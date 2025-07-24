import { MongoClient, Document, Db, ClientSession } from "mongodb";
import { ZodType } from "zod/v4";
import { Action, find, findOne, InferActionPayload, InferActionReturnType, MongalayerCollectionType } from "./actions/index.js";
import { AccessConfig, AccessPayload, AccessService } from "./access.js";
import z from "zod/v4";
import { FindOneReturnType } from "./actions/findOne.js";
import { FindReturnType } from "./actions/find.js";

export type { MongalayerCollectionType };

export type MongalayerCollection<TSchema extends Document = Document> = {
    schema: ZodType<TSchema>,
    access: AccessConfig<TSchema>
}

export type MongalayerCollections = Record<string, MongalayerCollection<any>>;

export type MongalayerOptions = {
    /**
     * @description Enable MongoDB sessions for transactions.
     * @default true
     */
    useSessions?: boolean,
    /**
     * @description Enable debugging mode. This will log all actions to the console.
     * @default false
     */
    debugging?: boolean
};

export class Mongalayer {

    constructor (
        private mongodbClient: MongoClient,
        private collections: MongalayerCollections,
        private options: MongalayerOptions
    ) { 
        options = {
            useSessions: true,
            debugging: false,
            ...options
        };
    }

    /**
     * This function uses currying to be able to provide the correct return types using Generics.
     */
    public async execute <TAction extends Action>(action: TAction, actionPayload: InferActionPayload<TAction>, accessPayload: AccessPayload): Promise<InferActionReturnType<TAction>> {
        let result: FindOneReturnType<Document> | FindReturnType<Document> | void,
            database: Db | null, 
            session: ClientSession | null = null;

        try {
            database = this.mongodbClient.db(action.database);

            if (this.options.useSessions) {
                session = this.mongodbClient.startSession()
            };

            const collection = database.collection(action.collection);

            let accessConfig: AccessConfig = [];

            if (this.collections[action.collection] !== void 0) {
                accessConfig = this.collections[action.collection].access;
            } else {
                console.debug("Mongalayer - Execute - No config found, using public access");
            }

            const accessService = new AccessService(accessPayload, accessConfig);

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
}