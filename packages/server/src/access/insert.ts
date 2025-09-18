import { Filter, Document, OptionalUnlessRequiredId } from "mongodb";
import { AccessDefinition, AccessPermission, AccessPermissions, AccessService } from "../access.js";
import z from "zod/v4";
import { matches } from "./matcher.js";

export type InsertableDocument<TSchema extends Document> = OptionalUnlessRequiredId<TSchema>;

type InsertIssue = {
    type: "field",
    field: string,
    issue: string
} | {
    type: "document",
    issue: string
}

type UnauthorizedDocument = { index: number, issues: InsertIssue[] };

export class InsertError extends Error {
    constructor (message: string, public unauthorizedDocuments: UnauthorizedDocument[]) {
        super(message);
    }
}

class InsertDocumentError extends Error {}

class InsertFieldsError extends Error {
    constructor (message: string, public issues: InsertIssue[]) {
        super(message);
    }
}

export class InsertAccessService extends AccessService {
    public getStages(): Record<string, any> {
        throw "N/A";
    }

    public validateDocuments (docs: InsertableDocument<Document>[]) {
        return z.array(this.documentSchema).parse(docs);
    }

    public validateDocumentsAccess (docs: InsertableDocument<Document>[]) {
        const unauthorizedDocuments: { index: number, issues: InsertIssue[] }[] = [];

        for (const [index, doc] of docs.entries()) {
            const accessRole = this.getAccessRole(doc);

            try {
                if (this.hydratedConfig.length > 0) {
                    if (accessRole === null) throw new InsertDocumentError("No access role found for document"); // This prevents documents from being inserted when roles are being used even when the default create access = true
                    
                    const hasInsertPermission = this.hasPermission(AccessPermissions.Create, accessRole.document, this.accessDefaults.document);

                    if (!hasInsertPermission) throw new InsertDocumentError("No create access for document");

                    const fieldInsertIssues: InsertIssue[] = [];

                    const fields = Object.keys(doc), fieldPermissions = accessRole.fields ?? {};

                    for (const field of fields) {
                        // Check if there's a specific permission for the field, otherwise use the default permission
                        if (!this.hasPermission(AccessPermissions.Create, fieldPermissions[field], accessRole.document, this.accessDefaults.document)) {
                            fieldInsertIssues.push({ type: "field", field, issue: `Role "${accessRole.role}" does not have create access for field "${field}".` });
                        }
                    }

                    if (fieldInsertIssues.length > 0) throw new InsertFieldsError("Field permission errors found for document", fieldInsertIssues);

                } else if (!this.hasPermission(AccessPermissions.Create, this.accessDefaults.document)) {
                    throw new InsertDocumentError("No (default) create access for document");
                }
            } catch (e) {
                if (e instanceof InsertFieldsError) {
                    unauthorizedDocuments.push({ index, issues: e.issues });
                } else if (e instanceof InsertDocumentError) {
                    unauthorizedDocuments.push({ index, issues: [{ type: "document", issue: e.message }] });
                } else {
                    throw e;
                }
            }
        }

        if (unauthorizedDocuments.length > 0) {
            throw new InsertError("Unauthorized documents found", unauthorizedDocuments);
        }
    }

    private getAccessRole (doc: InsertableDocument<Document>): AccessDefinition | null {
        for (const accessDef of this.hydratedRawConfig) {
            // Get the first matching role
            if (matches(doc, accessDef.filter ?? {})) {
                return accessDef;
            }
        }

        return null;
    }
}