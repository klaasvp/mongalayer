import type { Document, Filter, MongoClient, OptionalUnlessRequiredId } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core";
import { ZodObject } from "zod/v4";
import { AccessFilter, customOperatorKeys } from "./schema/access/filter.js";
import { deleteObjectProperty, getValueByPath, isArray, isObject } from "@mongalayer/core";
import { SetRequired } from "type-fest";
import { UpdateSchema } from "./schema/update.js";
import { hasNearQuery } from "./query/near.js";

export const AccessPermissions = {
    /**
     * Note: This does not exclude the _id field. If you want to exclude the _id field, you need to add it to the fields object.
     */
    None: 0,
    Read: 0b0001,
    Create: 0b0010,
    Update: 0b0100,
    /**
     * ReadUpdate = Read + Update permission without Create permission.
     */
    ReadUpdate: 0b0101,
    /**
     * ReadWrite also implies all permissions.
     * To exclude Update you can do AccessPermissions.ReadWrite & ~AccessPermissions.Update OR AccessPermissions.ReadWrite ^ AccessPermissions.Update
     */
    ReadWrite: 0b0111,
} as const;

export type AccessPermissionsType = typeof AccessPermissions;
export type AccessPermission = AccessPermissionsType[keyof AccessPermissionsType] | number;

export type AccessDefinitionFilter<TSchema extends Document = Document> = AccessFilter | Filter<TSchema>

type Fields<TSchema extends Document = Document> = {
    [K in keyof TSchema]?: AccessPermission
}

type FieldsArray<TSchema extends Document = Document> = (keyof TSchema)[];

export class AccessValidatorError extends Error {}

type AccessValidatorContext<TAccessPayload extends AccessPayload> = {
    database: string,
    collection: string,
    action: "create" | "update",
    accessData: TAccessPayload,
    client: MongoClient
}

export type CreateAccessValidator<TSchema extends Document, TAccessPayload extends AccessPayload = AccessPayload> = (context: AccessValidatorContext<TAccessPayload>, document: TSchema) => Promise<boolean | void>
export type UpdateAccessValidator<TSchema extends Document, TAccessPayload extends AccessPayload = AccessPayload> = (context: AccessValidatorContext<TAccessPayload>, document: TSchema, update: UpdateSchema) => Promise<boolean | void>

export type UpdateAccessValidatorDef<TSchema extends Document, TSchemaFields extends FieldsArray<TSchema> = FieldsArray<TSchema>> = {
    validatorFields?: TSchemaFields,
    validator: UpdateAccessValidator<Pick<TSchema, TSchemaFields[number] | "_id"> & { __mongalayer_role?: string | null }>
}

export const defineUpdateAccessValidator = <TSchema extends Document, TAccessPayload extends AccessPayload = AccessPayload> () => <TSchemaFields extends FieldsArray<TSchema>> (
    validatorFields: TSchemaFields,
    validator: UpdateAccessValidator<Pick<TSchema, TSchemaFields[number] | "_id"> & { __mongalayer_role?: string | null }, TAccessPayload>
) => ({
    validatorFields,
    validator
});

type AccessValidators<TSchema extends Document> = {
    /**
     * This function is called before the document is inserted and after the document & field permissions have been evaluated.
     * If the function returns false or throws an exception, the document(s) will not be inserted.
     * If the function returns true or does not return anything, the document(s) will be inserted.
     */
    create?: CreateAccessValidator<TSchema>,
    /**
     * This function is called before the document is updated and after the documents have been fetched for validation + after the document & field permissions have been evaluated.
     * If the function returns false or throws an exception, the document(s) will not be updated.
     * If the function returns true or does not return anything, the document(s) will be updated.
     * 
     * Note: when specifying validatorFields over multiple roles a union of all fields over the roles is used.
     */
    update?: UpdateAccessValidatorDef<TSchema>
}

export type AccessAlternativeCollection<TSchema extends Document = Document, TTargetSchema extends Document = Document> = {
    target: string,
    /** 
     * Supports root & nested object properties or string arrays. Make sure to index this field for performance. 
     * In case this field is a nested property in a array field use "targetFieldArrayPath" to define the array field path.
     * */
    targetField: keyof TTargetSchema | string,
    targetFieldArrayPath?: keyof TTargetSchema | string,
    /** Only supports root level properties. Make sure to index this field for performance. */
    localField: keyof TSchema
}

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document, TFilter extends AccessDefinitionFilter<TSchema> = AccessFilter> = {
    role: string,
    filter?: TFilter,
    collection?: AccessAlternativeCollection<TSchema, any>,
    fields?: Fields<TSchema>,
    document?: AccessPermission,
    delete?: boolean,
    validators?: AccessValidators<TSchema>
};

export type AccessConfig<TSchema extends Document = Document> = AccessDefinition<TSchema, AccessFilter>[];

// In the access service the AccessFilter is translated to a MongoDB Document Filter
type InternalAccessConfig<TSchema extends Document = Document> = SetRequired<AccessDefinition<TSchema, Filter<TSchema>>, "filter">[];

export type AccessPayload = Record<string, any>;

export type WithAccessRole<TSchema extends Document> = TSchema & { __mongalayer_role: string | null };

export type AccessDefaults = {
    /**
     * @description Default access field permission for all fields not explicitly defined in the access config. 
     * @default {AccessPermissions.Read}
     */
    document: AccessPermission,
    /**
     * @description Default delete permission for for a collection. 
     * @default {false}
     */
    delete: boolean
}

export abstract class AccessService {
    protected hydratedRawConfig: AccessConfig;
    protected hydratedConfig: InternalAccessConfig;
    protected hydratedConfigMap: Record<string, InternalAccessConfig[number]> = {};
    protected hasRolesWithAlternativeAccessCollection: boolean;

    constructor (
        protected client: MongoClient,
        protected database: string,
        protected collection: string,
        protected accessData: AccessPayload,
        protected accessConfig: AccessConfig,
        protected documentSchema: ZodObject,
        public accessDefaults: AccessDefaults
    ) {
        this.hydratedRawConfig = Array.isArray(accessConfig) ? accessConfig.map(access => ({
            ...access,
            filter: access.filter ? this.hydrateAccessFilter(access.filter) : void 0
        })) : [];
        this.hydratedConfig = this.hydratedRawConfig.map(access => ({
            ...access,
            filter: access.filter ? this.translateAccessFilter(access.filter) : {}
        }));
        this.hydratedConfigMap = this.hydratedConfig.reduce((acc, access) => ({ ...acc, [access.role]: access }), {});

        this.hasRolesWithAlternativeAccessCollection = this.hydratedConfig.some(access => access.collection !== void 0);
    }

    private hydrateAccessFilter (filter: AccessFilter): AccessFilter {
        const hydratedFilter = structuredClone(filter);

        iteratePrimitives(hydratedFilter, (key, value, replace) => {
            if (typeof value === "string" && value.indexOf("%%") === 0) {
                replace(getValueByPath(this.accessData, value.substring(2)));
            }
        });

        return hydratedFilter;
    }

    private translateAccessFilter (filter: AccessFilter): Filter<Document> {
        const translatedFilter = structuredClone(filter);

        replaceAccessFilterKeys(translatedFilter);

        return translatedFilter;
    }

    protected getAccessFilters (): Filter<Document> | null {
        const filters: Filter<Document>[] = [];

        // If there are roles with an alternative access collection we cannot combine the filters into a single $or filter
        // because those filters need to be applied in a $lookup stage.
        // In that case we will only apply the filters of the roles without an alternative access collection.
        if (!this.hasRolesWithAlternativeAccessCollection) {
            filters.push(...this.hydratedConfig.map(access => access.filter));
        }

        if (filters.length === 0) return null;

        return { $or: filters };
    } 

    protected getRoleStages (currentFilter: Filter<Document> = {}): Document[] | null {
        if (this.hydratedConfig.length > 0) {
            // The lookup workaround is to support query predicates in the role filter mechanism.
            // On of the more powerfull features or this is that $in supports array on array matching. ["a", "b"] in ["b", "c"] will return true.
            const rolePipeline: Document[] = [
                ...this.hydratedConfig.map(access => {
                    const roleMatchField = access.collection?.targetFieldArrayPath !== void 0 
                        ? `${access.collection!.targetFieldArrayPath as string}.${access.collection!.targetField as string}` 
                        : access.collection?.targetField as string ?? "_id";

                    const roleMatchPotentialArray = access.collection?.targetFieldArrayPath !== void 0 
                        ? access.collection!.targetFieldArrayPath as string
                        : roleMatchField

                    return {
                        $lookup: {
                            from: access.collection?.target ?? this.collection,
                            pipeline: [
                                { 
                                    $match: access.collection === void 0 && Object.keys(currentFilter).length > 0 && !hasNearQuery(currentFilter)
                                    ? { $and: [currentFilter, access.filter] } // Only apply the current filter when not using an alternative collection and has no near query
                                    : access.filter 
                                },
                                { $project: { [roleMatchField]: 1 } }, // Project only the ID
                                { $unwind: `$${roleMatchPotentialArray}` }, // Unwind also works for non-array fields, it interprets the field as an array with a single value
                                { $replaceWith: { __mongalayer_role_id: `$${roleMatchField}` } },
                            ],
                            as: `__mongalayer_role.${access.role}`
                        }
                    };
                })
            ]

            rolePipeline.push({ $addFields: { 
                __mongalayer_role: {
                    $switch: {
                        branches: this.hydratedConfig.map(access => ({
                            case: {$in: [
                                { __mongalayer_role_id: `$${access.collection?.localField ?? "_id"}` }, // Match the projected ID
                                `$__mongalayer_role.${access.role}`
                            ]},
                            then: access.role
                        })),
                        default: null
                    }
                }
            } })

            // Normally null roles are not present due to the access filter, but when using alternative collections this is possible.
            // So we need to filter them out here.
            if (this.hasRolesWithAlternativeAccessCollection) {
                rolePipeline.push({ $match: {
                    __mongalayer_role: { $ne: null }
                } });
            }

            return rolePipeline;
        }

        return null;
    }

    abstract getStages(): Record<string, any>;

    protected hasPermission (requiredPermission: AccessPermission, permissionValue: number | undefined, ...fallbackPermissionValues: (number | undefined)[]): boolean {
        const permissionValues = [permissionValue, ...fallbackPermissionValues].filter(permission => permission !== void 0);

        // Validate the first defined permission value against the required permission
        return permissionValues.length > 0 && (permissionValues[0] & requiredPermission) === requiredPermission;
    }

    protected async invokeValidator (role: AccessDefinition<Document>, validator: "create", { document }: { document: OptionalUnlessRequiredId<Document> }): Promise<boolean | null>;
    protected async invokeValidator (role: AccessDefinition<Document>, validator: "update", { document, update }: { document: OptionalUnlessRequiredId<Document>, update: UpdateSchema }): Promise<boolean | null>;
    protected async invokeValidator <TValidator extends keyof AccessValidators<Document>>(role: AccessDefinition<Document>, validator: TValidator, data: Record<string, any>): Promise<boolean | null> {
        if (role.validators !== void 0 && role.validators[validator] !== void 0) {
            const context: AccessValidatorContext<AccessPayload> = {
                action: validator,
                accessData: this.accessData,
                client: this.client,
                database: this.database,
                collection: this.collection
            };

            if (validator === "create") {
                const createValidator = role.validators[validator] as CreateAccessValidator<Document>;

                if (typeof createValidator === "function") {
                    return await createValidator.call(null, context, data.document) ?? true; // If the validator returns nothing (undefined) or null -> return true
                }
            } else if (validator === "update") {
                const updateValidatorDef = role.validators[validator] as UpdateAccessValidatorDef<Document>;

                if (typeof updateValidatorDef.validator === "function") {
                    return await updateValidatorDef.validator.call(null, context, data.document, data.update) ?? true;
                }
            }
        }

        return null;
    }
    
    protected getProjectionType (projection?: Document): 0 | 1 | null {
        if (isObject(projection)) {
            try {
                iteratePrimitives(projection, (key, value, replace, path) => {
                    const projectionValue = !!value ? 1 : 0, isID = key === "_id" && path.length === 1;

                    if (!isID && projectionValue === 0) {
                        throw "exit";
                    }
                });

                // This is an edge case, if only _id is excluded we want to type to be exclusive
                if (Object.keys(projection).length === 1 && projection["_id"] === 0) {
                    return 0;
                }

                return 1;
            } catch (e) {
                if (e !== "exit") throw e;

                return 0;
            }
        }

        return null;
    }

    /**
     * Delete the fields in-place
     */
    public processFields <TSchema extends Document> (docs: TSchema[], projection?: Document): Partial<TSchema>[] {
        const pathsToDelete: string[] = [
            "__mongalayer_role",
            "__mongalayer_geonear_distance"
        ]

        const projectionType = this.getProjectionType(projection);

        if (projectionType !== null && isObject(projection)) {
            // _id is a special one, it's always included in the final document.
            if (projection["_id"] === 0) {
                pathsToDelete.push("_id");
            }

            if (projectionType === 0) {
                iteratePrimitives(projection, (key, value, replace, path, parent) => {
                    const isID = key === "_id" && path.length === 1;

                    if (!isID) {
                       pathsToDelete.push(path.join("."));
                    }
                });
            }
        }

        for (const doc of docs) {
            const { fields, document } = { 
                fields: {}, 
                document: this.accessDefaults.document,
                ...this.hydratedConfigMap[doc.__mongalayer_role] ?? {}
            }

            // Pre-clean the document that need to be delete anyway
            for (const pathToDelete of pathsToDelete) {
                deleteObjectProperty(pathToDelete, doc);
            }

            const remainingKeys = Object.keys(doc).filter(key => key !== "_id");

            for (const key of remainingKeys) {                
                if (!this.hasPermission(AccessPermissions.Read, fields[key], document)) {
                    delete doc[key];
                }
            }
        }

        return docs;
    }
}

export function replaceAccessFilterKeys (instance: any[] | Record<string, unknown>) {
    if (isArray(instance)) {
        for (const item of instance) {
            if (isObject(item)) replaceAccessFilterKeys(item);
        }
    } else if (isObject(instance)) {
        const keys = Object.keys(instance);

        let key: string | undefined;

        while ((key = keys.shift()) !== void 0) {
            if (customOperatorKeys.includes(key as any)) {
                if (instance.$expr === void 0) {
                    instance.$expr = {};
                    keys.push("$expr");
                }

                if (key === "$$nin") {
                    (instance.$expr as Record<string, unknown>).$not = { $in: instance[key] };
                } else {
                    (instance.$expr as Record<string, unknown>)[key.slice(1)] = instance[key];
                }
                
                delete instance[key];
            }
        }

        for (const key in instance) {
            const value = instance[key];
            if (isObject(value) || isArray(value)) {
                replaceAccessFilterKeys(value);
            }
        }
    } 
}
