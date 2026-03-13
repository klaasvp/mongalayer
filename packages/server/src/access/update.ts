import type { Filter, Document, WithId, ObjectId, FilterOperators } from "mongodb";
import { PreloadRoleAccessService, PreloadRoleStages } from "./preloadRole.js";
import { UpdateSchema } from "../schema/update.js";
import { AccessDefinition, AccessPermissions, AccessValidatorError } from "../access.js";
import { InsertAccessService } from "./insert.js";
import { AuthorizationError, AuthorizationErrorCode, AuthorizationIssue, merge, UnauthorizedDocument, unflatten } from "@mongalayer/core";
import { deepPartial, getSubschema } from "@mongalayer/utils";
import { FilterSchema } from "../schema/query.js";
import {  } from "@mongalayer/core";

export type UpdatableDocument = WithId<{ __mongalayer_role?: string | null }>;

type UpdateStages = PreloadRoleStages & {
    $project: Record<string, 1>
}

class UpdateDocumentError extends Error {}

class UpdateFieldsError extends Error {
    constructor (message: string, public issues: AuthorizationIssue[]) {
        super(message);
    }
}

export class UpdateAccessService extends PreloadRoleAccessService {
    public validateUpdateFields (update: UpdateSchema) {
        const toValidate = structuredClone(update);
        let partialObject = {} as Record<string, any>;

        for (const operator of Object.keys(toValidate) as (keyof UpdateSchema)[]) {
            const op = toValidate[operator] as Record<string, any>;

            if (["$set", "$inc"].includes(operator)) {
                // Positional $ operator will be converted to array index 0 for validation purposes, as we don't know the actual index at this point and the schema should be the same for all items in the array.
                partialObject = merge([partialObject, unflatten(op, { allowPositionalDollar: true })]);
            } else if (operator === "$unset") {
                for (const key of Object.keys(op)) {
                    const keySchema = getSubschema(this.documentSchema, key);
                    if (keySchema?.schema === void 0 ) {
                        throw new Error(`Field "${key}" in $unset does not exist in the document schema`);
                    } else if (keySchema?.meta?.optional !== true) {
                        throw new Error(`Field "${key}" in $unset cannot be removed because it is not optional in the document schema`);
                    }
                }
            }
        }

        const partialDocumentSchema = deepPartial(this.documentSchema);
        partialDocumentSchema.parse(partialObject);
    }

    public getFinalUpdateFilter (updateFilter: Filter<Document>, filter: Filter<Document>, update: UpdateSchema): Filter<Document> {
        // If the update contains positional operators, we need to use the original filter with the _id of the document to update
        if (update.$set && Object.keys(update.$set).some(key => key.split(".").slice(1).includes("$"))) {
            return { ...filter, _id: updateFilter._id };
        }

        return updateFilter;
    }

    public async validateDocumentsAccess (docsWithRole: UpdatableDocument[], update: UpdateSchema, requireReadPermission: boolean = false): Promise<ObjectId[]> {
        const unauthorizedDocuments: UnauthorizedDocument[] = [];

        const fields = this.getRootPropertiesFromUpdate(update);

        for (const [index, doc] of docsWithRole.entries()) {
            const accessRole = this.getAccessRole(doc);

            try {
                if (this.hydratedConfig.length > 0) {
                    if (accessRole === null) throw new UpdateDocumentError("No access role found for document"); // This prevents documents from being Updated when roles are being used even when the default update access = true

                    const hasUpdatePermission = this.hasPermission(AccessPermissions.Update, accessRole.document, this.accessDefaults.document);

                    if (!hasUpdatePermission && fields.length === 0) throw new UpdateDocumentError("No update access for document");

                    const fieldUpdateIssues: AuthorizationIssue[] = [];

                    const fieldPermissions = accessRole.fields ?? {};

                    for (const field of fields) {
                        // Check if there's a specific permission for the field, otherwise use the default permission
                        if (!this.hasPermission(AccessPermissions.Update, fieldPermissions[field], accessRole.document, this.accessDefaults.document)) {
                            fieldUpdateIssues.push({ type: "field", field, issue: `Role "${accessRole.role}" does not have update access for field "${field}".` });
                        }
                    }

                    if (fieldUpdateIssues.length > 0) throw new UpdateFieldsError("Field permission errors found for document", fieldUpdateIssues);

                    const validatorResult = await this.invokeValidator(accessRole, "update", { document: doc, update });

                    // The validator is allowed to return an exception which is caught below or false to indicate that the document is invalid in which case we throw an exception
                    if (validatorResult === false) {
                        throw new UpdateDocumentError("Document failed custom validation");
                    }                 
                } else if (!this.hasPermission(AccessPermissions.Update, this.accessDefaults.document)) {
                    throw new UpdateDocumentError("No (default) update access for document");
                } else if (requireReadPermission && !this.hasPermission(AccessPermissions.Read, this.accessDefaults.document)) {
                    throw new UpdateDocumentError("No (default) read access for document");
                }
            } catch (e) {
                if (e instanceof UpdateFieldsError) {
                    unauthorizedDocuments.push({ index, id: doc._id, issues: e.issues });
                } else if (e instanceof UpdateDocumentError || e instanceof AccessValidatorError) {
                    unauthorizedDocuments.push({ index, id: doc._id, issues: [{ type: "document", issue: e.message }] });
                } else {
                    throw e;
                }
            }
        }

        if (unauthorizedDocuments.length > 0) {
            throw new AuthorizationError("Unauthorized documents found", unauthorizedDocuments, AuthorizationErrorCode.UnauthorizedUpdate);
        } else {
            return docsWithRole.map(({ _id }) => _id);
        }
    }

    private getAccessRole (doc: UpdatableDocument): AccessDefinition | null {
        if (!doc.__mongalayer_role) return null;

        const roleDef = this.hydratedConfig.find(r => r.role === doc.__mongalayer_role);

        return roleDef ?? null; // Return null if no role found
    }

    private getRootPropertiesFromUpdate (update: UpdateSchema): string[] {
        const rootProperties: string[] = [];

        for (const operator of Object.keys(update) as (keyof UpdateSchema)[]) {
            const op = update[operator] as Record<string, any>;

            for (const field of Object.keys(op)) {
                rootProperties.push(field.split(".")[0]);
            }
        }

        return rootProperties;
    }

    public async getUpsertDocument (filter: FilterSchema, update: UpdateSchema): Promise<{ doc: Document, role: AccessDefinition | null }> {
        const upsertAccessService = new InsertAccessService(
            this.client,
            this.database,
            this.collection,
            this.accessData,
            this.accessConfig,
            this.documentSchema,
            this.accessDefaults
        );

        // TODO conflicts in dot notation keys between filter and update operators
        const insertableDoc = {
            ...filter,
            ...update.$set,
            ...update.$unset ? Object.fromEntries(Object.keys(update.$unset).map(key => [key, null])) : {},
            ...update.$inc ? Object.fromEntries(Object.keys(update.$inc).map(key => [key, update.$inc?.[key] ?? 0])) : {}
        };
        
        // Validate the document against the schema
        upsertAccessService.validateDocuments([insertableDoc]);

        await upsertAccessService.validateDocumentsAccess([insertableDoc]);

        return { doc: insertableDoc, role: (await upsertAccessService.getAccessRoles([insertableDoc]))[0] };
    }

    public getStages (currentFilter: Filter<Document> = {}): UpdateStages {
        const stages = super.getStages(currentFilter) as UpdateStages;

        const projectionFields: string[] = [ "_id", "__mongalayer_role" ];

        for (const role of this.hydratedConfig) {
            if (Array.isArray(role.validators?.update?.validatorFields)) {
                projectionFields.push(...role.validators.update.validatorFields as string[]);
            }
        }

        stages.$project = Object.fromEntries(projectionFields.map(field => [field, 1]));

        return stages;
    };
}