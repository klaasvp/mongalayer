import { MongoServerError } from "mongodb";

export enum MongalayerErrorType {
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

export type MongalayerErrorCode<T extends MongalayerErrorType> = 
    T extends MongalayerErrorType.Validation ? ValidationErrorCode :
    T extends MongalayerErrorType.Database ? DatabaseErrorCode :
    T extends MongalayerErrorType.Authorization ? AuthorizationErrorCode :
    string;

export const MongalayerErrorName = "MongalayerError" as const;

export class MongalayerError<ErrorType extends MongalayerErrorType = MongalayerErrorType> extends Error {
    public readonly name = MongalayerErrorName;
    
    constructor (
        public readonly type: ErrorType, 
        public readonly code: MongalayerErrorCode<ErrorType>, 
        message: string
    ) {
        super(message);
    }

    static fromJSON (json: string) {
        const data = JSON.parse(json);

        return new MongalayerError(data.type, data.code, data.message);
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

export class ValidationError extends MongalayerError {
    constructor (message: string, code: ValidationErrorCode = ValidationErrorCode.Unknown) {
        super(MongalayerErrorType.Validation, code, message);
    }
}

export class DatabaseError extends MongalayerError {
    constructor (message: string, code: DatabaseErrorCode = DatabaseErrorCode.Unknown) {
        super(MongalayerErrorType.Database, code, message);
    }

    static buildFromMongoError (error: MongoServerError): DatabaseError {
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

export class AuthorizationError extends MongalayerError {
    constructor (message: string, public unauthorizedDocuments: UnauthorizedDocument[], code: AuthorizationErrorCode = AuthorizationErrorCode.UnauthorizedInsert) {
        super(MongalayerErrorType.Authorization, code, message);
    }
}