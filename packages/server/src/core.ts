import { MongoClient, Document, Db, ClientSession } from "mongodb";
import { ZodType } from "zod/v4";
import { Action, find, findOne } from "./actions/index.js";
import { AccessConfig, AccessPayload, AccessService } from "./access.js";
import z from "zod/v4";

export type MongalayerCollection<TSchema extends Document = Document> = {
    schema: ZodType<TSchema>,
    access: AccessConfig<TSchema>
}

export type MongalayerCollections = Record<string, MongalayerCollection<any>>;

export type MongalayerOptions = {
    useSessions?: boolean,
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

    public async execute <TSchema extends Document> (action: Action<TSchema>, accessPayload: AccessPayload): Promise<TSchema | TSchema[] | null> {
        let result,
            database: Db | null, 
            session: ClientSession | null = null;

        try {
            database = this.mongodbClient.db(action.database);

            if (this.options.useSessions) {
                session = this.mongodbClient.startSession()
            };

            const collection = database.collection<TSchema>(action.collection);

            let accessConfig: AccessConfig = [];

            if (this.collections[action.collection] !== void 0) {
                accessConfig = this.collections[action.collection].access;
            } else {
                console.debug("Mongalayer - Execute - No config found, using public access");
            }

            const accessService = new AccessService(accessPayload, accessConfig);

            try {
                switch (action.operation) {
                    case "findOne": result = await findOne<TSchema>(collection, accessService, action.payload); break;
                    case "find": result = await find<TSchema>(collection, accessService, action.payload); break;
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

        return result;
    }
}