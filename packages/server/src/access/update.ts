import { Filter, Document, WithId, ObjectId } from "mongodb";
import { PreloadRoleAccessService, PreloadRoleStages } from "./preloadRole.js";
import { UpdateSchema } from "../schema/update.js";
import { AccessDefinition, AccessPermissions, AccessValidatorError } from "../access.js";
import { InsertAccessService } from "./insert.js";
import { merge, unflatten } from "@mongalayer/core/utils/object";
import { deepPartial, getSubschema } from "../schema/helper.js";

export type UpdatableDocument = WithId<{ __mongalayer_role?: string | null }>;

type UpdateStages = PreloadRoleStages & {
    $project: Record<string, 1>
}

type UpdateIssue = {
    type: "field",
    field: string,
    issue: string
} | {
    type: "document",
    issue: string
}

type UnauthorizedDocument = { index: number, issues: UpdateIssue[] };

export class UpdateError extends Error {
    constructor (message: string, public unauthorizedDocuments: UnauthorizedDocument[]) {
        super(message);
    }
}

class UpdateDocumentError extends Error {}

class UpdateFieldsError extends Error {
    constructor (message: string, public issues: UpdateIssue[]) {
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
                partialObject = merge([partialObject, unflatten(op)]);
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

    public async validateDocumentsAccess (docsWithRole: UpdatableDocument[], update: UpdateSchema): Promise<ObjectId[]> {
        const unauthorizedDocuments: { index: number, id: ObjectId, issues: UpdateIssue[] }[] = [];

        const fields = this.getRootPropertiesFromUpdate(update);

        for (const [index, doc] of docsWithRole.entries()) {
            const accessRole = this.getAccessRole(doc);

            try {
                if (this.hydratedConfig.length > 0) {
                    if (accessRole === null) throw new UpdateDocumentError("No access role found for document"); // This prevents documents from being Updated when roles are being used even when the default update access = true

                    const hasUpdatePermission = this.hasPermission(AccessPermissions.Update, accessRole.document, this.accessDefaults.document);

                    if (!hasUpdatePermission) throw new UpdateDocumentError("No update access for document");

                    const fieldUpdateIssues: UpdateIssue[] = [];

                    const fieldPermissions = accessRole.fields ?? {};

                    for (const field of fields) {
                        // Check if there's a specific permission for the field, otherwise use the default permission
                        if (!this.hasPermission(AccessPermissions.Update, fieldPermissions[field], accessRole.document, this.accessDefaults.document)) {
                            fieldUpdateIssues.push({ type: "field", field, issue: `Role "${accessRole.role}" does not have update access for field "${field}".` });
                        }
                    }

                    if (fieldUpdateIssues.length > 0) throw new UpdateFieldsError("Field permission errors found for document", fieldUpdateIssues);

                    const validatorResult = await this.invokeValidator(accessRole, "update", doc);

                    // The validator is allowed to return an exception which is caught below or false to indicate that the document is invalid in which case we throw an exception
                    if (validatorResult === false) {
                        throw new UpdateDocumentError("Document failed custom validation");
                    }                 
                } else if (!this.hasPermission(AccessPermissions.Update, this.accessDefaults.document)) {
                    throw new UpdateDocumentError("No (default) update access for document");
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
            throw new UpdateError("Unauthorized documents found", unauthorizedDocuments);
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

    public getUpsertAccessService (): InsertAccessService {
        return new InsertAccessService(
            this.client,
            this.database,
            this.collection,
            this.accessData,
            this.accessConfig,
            this.documentSchema,
            this.accessDefaults
        );
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