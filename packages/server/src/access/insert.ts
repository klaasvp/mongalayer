import type { Document, OptionalUnlessRequiredId } from "mongodb";
import { AccessDefinition, AccessPermissions, AccessService, AccessValidatorError } from "../access.js";
import z from "zod";
import { matches } from "./matcher.js";
import { AuthorizationError, AuthorizationErrorCode, AuthorizationIssue, UnauthorizedDocument } from "@mongalayer/core";
import { Debugging } from "../core.js";

type InsertRoleResult = { __mongalayer_role_id: string }[];
type InsertRoleResults = (InsertRoleResult | null)[];

export type InsertableDocument<TSchema extends Document> = OptionalUnlessRequiredId<TSchema>;

class InsertDocumentError extends Error {}

class InsertFieldsError extends Error {
    constructor (message: string, public issues: AuthorizationIssue[]) {
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

    public async validateDocumentsAccess (docs: InsertableDocument<Document>[]) {
        const unauthorizedDocuments: UnauthorizedDocument[] = [];

        const accessRoles = await this.getAccessRoles(docs);

        for (const [index, doc] of docs.entries()) {
            const accessRole = accessRoles[index];//this.getAccessRole(doc);

            try {
                if (this.hydratedConfig.length > 0) {
                    if (accessRole === null) throw new InsertDocumentError("No access role found for document"); // This prevents documents from being inserted when roles are being used even when the default create access = true
                    
                    const hasInsertPermission = this.hasPermission(AccessPermissions.Create, accessRole.document, this.accessDefaults.document);

                    if (!hasInsertPermission) throw new InsertDocumentError("No create access for document");

                    const fieldInsertIssues: AuthorizationIssue[] = [];

                    const fields = Object.keys(doc), fieldPermissions = accessRole.fields ?? {};

                    for (const field of fields) {
                        // Check if there's a specific permission for the field, otherwise use the default permission
                        if (!this.hasPermission(AccessPermissions.Create, fieldPermissions[field], accessRole.document, this.accessDefaults.document)) {
                            fieldInsertIssues.push({ type: "field", field, issue: `Role "${accessRole.role}" does not have create access for field "${field}".` });
                        }
                    }

                    if (fieldInsertIssues.length > 0) throw new InsertFieldsError("Field permission errors found for document", fieldInsertIssues);

                    const validatorResult = await this.invokeValidator(accessRole, "create", { document: doc });

                    // The validator is allowed to return an exception which is caught below or false to indicate that the document is invalid in which case we throw an exception
                    if (validatorResult === false) {
                        throw new InsertDocumentError("Document failed custom validation");
                    }                    
                } else if (!this.hasPermission(AccessPermissions.Create, this.accessDefaults.document)) {
                    throw new InsertDocumentError("No (default) create access for document");
                }
            } catch (e) {
                if (e instanceof InsertFieldsError) {
                    unauthorizedDocuments.push({ index, issues: e.issues });
                } else if (e instanceof InsertDocumentError || e instanceof AccessValidatorError) {
                    unauthorizedDocuments.push({ index, issues: [{ type: "document", issue: e.message }] });
                } else {
                    throw e;
                }
            }
        }

        if (unauthorizedDocuments.length > 0) {
            throw new AuthorizationError("Unauthorized documents found", unauthorizedDocuments, AuthorizationErrorCode.UnauthorizedInsert);
        }
    }

    public getAccessRole (doc: InsertableDocument<Document>, roleResults: InsertRoleResults | null): AccessDefinition | null {
        for (const [index, accessDef] of this.hydratedRawConfig.entries()) {
            const matchers = [accessDef.filter ?? {}];
            
            if (accessDef.collection !== void 0 && roleResults !== null) {
                const roleResult = roleResults[index];
                
                matchers.push({$$in: [
                    doc[accessDef.collection.localField],
                    roleResult?.map(r => r.__mongalayer_role_id) ?? []
                ]});
            }
            
            // Get the first matching role
            if (matchers.every(matcher => matches(doc, matcher))) {
                return accessDef;
            }
        }

        return null;
    }

    public async getAccessRoles (docs: InsertableDocument<Document>[]): Promise<(AccessDefinition | null)[]> {
        let roleQueryResults: InsertRoleResults | null = null;

        if (this.hasRolesWithAlternativeAccessCollection) {
            const roleQueries: Promise<InsertRoleResult | null>[] = [];

            for (const access of this.hydratedConfig) {
                if (access.collection !== void 0) {
                    const lookupStage = this.getTargetRoleState(access.role, access.collection);
                    
                    if (Debugging.isEnabled()) {
                        console.debug(`Mongalayer - Insert - role with $lookup:`, access.role, JSON.stringify(lookupStage));
                    }
                    
                    roleQueries.push(this.client.db(this.database).collection(lookupStage.$lookup.from).aggregate(lookupStage.$lookup.pipeline).toArray() as Promise<InsertRoleResult>);
                } else {
                    if (Debugging.isEnabled()) {
                        console.debug(`Mongalayer - Insert - role without $lookup:`, access.role);
                    }

                    roleQueries.push(Promise.resolve(null));
                }
            }

            roleQueryResults = await Promise.all(roleQueries) as InsertRoleResults;
        }

        return docs.map(doc => this.getAccessRole(doc, roleQueryResults));
    }
}