// Don't import directly from mongodb as this is used in the client layer and will cause bundling issues
type MongoServerErrorLike = {
    code?: number | string,
    message: string
}

export namespace MongalayerError {
    export enum Type {
        Validation = "ValidationError",
        Database = "DatabaseError",
        Authorization = "AuthorizationError",
        Unknown = "UnknownError"
    };

    export enum ValidationErrorCode {
        Unknown = "UNKNOWN_VALIDATION_ERROR"
    }

    export enum DatabaseErrorCode {
        DuplicateKey = "DUPLICATE_KEY",
        Unknown = "UNKNOWN_DATABASE_ERROR"
    }

    export enum AuthorizationErrorCode {
        UnauthorizedInsert = "UNAUTHORIZED_INSERT",
        UnauthorizedUpdate = "UNAUTHORIZED_UPDATE",
        Unknown = "UNKNOWN_AUTHORIZATION_ERROR"
    }

    export type Code<T extends Type> = 
        T extends Type.Validation ? ValidationErrorCode :
        T extends Type.Database ? DatabaseErrorCode :
        T extends Type.Authorization ? AuthorizationErrorCode :
        string;

    export const name = "MongalayerError" as const;

    export class ServerError<ErrorType extends Type = Type> extends Error {
        public readonly name = name;
        constructor (
            public readonly type: ErrorType, 
            public readonly code: Code<ErrorType>, 
            message: string
        ) {
            super(message);
        }

        static fromJSON (json: string) {
            const data = JSON.parse(json);
            return new ServerError(data.type, data.code, data.message);
        }

        toJSON() {
            return { 
                name: this.name,
                type: this.type, 
                code: this.code,
                message: this.message 
            };
        }
    }

    export class ValidationError extends ServerError {
        constructor (message: string, code: ValidationErrorCode = ValidationErrorCode.Unknown) {
            super(Type.Validation, code, message);
        }
    }

    export class DatabaseError extends ServerError {
        constructor (message: string, code: DatabaseErrorCode = DatabaseErrorCode.Unknown) {
            super(Type.Database, code, message);
        }

        static buildFromMongoError (error: MongoServerErrorLike): DatabaseError {
            switch (error.code) {
                case 11000:
                    return new DatabaseError("Duplicate key error", DatabaseErrorCode.DuplicateKey);
                default:
                    return new DatabaseError("Unknown database error", DatabaseErrorCode.Unknown);
            }
        }
    }

    // Authorization error
    export type AuthorizationIssue = {
        type: "field",
        field: string,
        issue: string
    } | {
        type: "document",
        issue: string
    }

    export type UnauthorizedDocument = { index: number, id?: any, issues: AuthorizationIssue[] };

    export class AuthorizationError extends ServerError {
        constructor (message: string, public unauthorizedDocuments: UnauthorizedDocument[], code: AuthorizationErrorCode = AuthorizationErrorCode.UnauthorizedInsert) {
            super(Type.Authorization, code, message);
        }
    }
}