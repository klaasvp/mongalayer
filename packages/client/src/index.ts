export type * from "@mongalayer/server/client";

export {
    Client as MongalayerClient
} from "./client.js"

export type {
    Db
} from "./db.js"

export type {
    Collection
} from "./collection.js"

export {
    BatchOperation
} from "./batch.js"

export {
    MongalayerAPIError
} from "./error.js";

export { 
    ServerError, 
    type ServerErrorCode, 
    ServerErrorType, 
    serverErrorName,
    ValidationErrorCode, 
    DatabaseErrorCode, 
    AuthorizationErrorCode
} from "@mongalayer/core";