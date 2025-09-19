import { Document, Filter, MongoClient } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core/utils/replacer";
import { ZodObject } from "zod/v4";
import { AccessFilter, customOperatorKeys } from "./schema/access/filter.js";
import { getValueByPath, isArray, isObject } from "@mongalayer/core/utils/object";
import { SetRequired } from "type-fest";

export const AccessPermissions = {
    /**
     * Note: This does not exclude the _id field. If you want to exclude the _id field, you need to add it to the fields object.
     */
    None: 0,
    Read: 0b0001,
    Create: 0b0010,
    Update: 0b0100,
    /**
     * ReadWrite also implies all permissions.
     * To exclude Update you can do AccessPermissions.ReadWrite & ~AccessPermissions.Update OR AccessPermissions.ReadWrite ^ AccessPermissions.Update
     */
    ReadWrite: 0b0111,
} as const;

export type AccessPermissionsType = typeof AccessPermissions;
export type AccessPermission = AccessPermissionsType[keyof AccessPermissionsType] | number;

type AccessDefinitionFilter<TSchema extends Document = Document> = AccessFilter | Filter<TSchema>

type Fields<TSchema extends Document = Document> = {
    [K in keyof TSchema]?: AccessPermission
}

export class AccessValidatorError extends Error {}

type AccessValidatorContext = {
    database: string,
    collection: string,
    action: "create",
    accessData: AccessPayload,
    client: MongoClient
}

export type AccessValidator<TSchema extends Document> = (context: AccessValidatorContext, document: TSchema) => boolean | void

type AccessValidators<TSchema extends Document> = {
    /**
     * This function is called before the document is inserted and after the document & field permissions have been evaluated.
     * If the function returns false or throws an exception, the document(s) will not be inserted.
     * If the function returns true or does not return anything, the document(s) will be inserted.
     */
    create?: AccessValidator<TSchema>
}

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document, TFilter extends AccessDefinitionFilter<TSchema> = AccessFilter> = {
    role: string,
    filter?: TFilter,
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

    constructor (
        protected client: MongoClient,
        protected database: string,
        protected collection: string,
        protected accessData: AccessPayload,
        accessConfig: AccessConfig,
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

        filters.push(...this.hydratedConfig.map(access => access.filter));

        if (filters.length === 0) return null;

        return { $or: filters };
    } 

    protected getRoleStages (): Document[] | null {
        if (this.hydratedConfig.length > 0) {
            // The lookup workaround is to support query predicates in the role filter mechanism.
            // On of the more powerfull features or this is that $in supports array on array matching. ["a", "b"] in ["b", "c"] will return true.
            const rolePipeline: Document[] = [
                ...this.hydratedConfig.map(access => ({
                    $lookup: {
                        from: this.collection,
                        pipeline: [
                            { $match: access.filter },
                            { $project: { _id: 1 } } // Project only the ID
                        ],
                        as: `__mongalayer_role.${access.role}`
                    }
                }))
            ]

            rolePipeline.push({ $addFields: { 
                __mongalayer_role: {
                    $switch: {
                        branches: this.hydratedConfig.map(access => ({
                            case: {$in: [
                                { _id: "$_id" }, // Match the projected ID
                                `$__mongalayer_role.${access.role}`
                            ]},
                            then: access.role
                        })),
                        default: null
                    }
                }
            } })

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

    protected invokeValidator (role: AccessDefinition<Document>, validator: keyof AccessValidators<Document>, doc: Document): boolean | null {
        if (role.validators !== void 0 && typeof role.validators[validator] === "function") {
            return role.validators[validator].call(null, {
                action: validator,
                accessData: this.accessData,
                client: this.client,
                database: this.database,
                collection: this.collection
            }, doc) ?? true; // If the validator returns nothing (undefined) or null -> return true
        }

        return null;
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
