export class ValidationError extends Error {}
export class DatabaseError extends Error {}

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

export class AuthorizationError extends Error {
    constructor (message: string, public unauthorizedDocuments: UnauthorizedDocument[]) {
        super(message);
    }
}