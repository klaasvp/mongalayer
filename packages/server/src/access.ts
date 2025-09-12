import { Document, Filter } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core/utils/replacer";
import { ZodObject } from "zod/v4";

export const AccessFieldPermissions = {
    /**
     * Note: This does not exclude the _id field. If you want to exclude the _id field, you need to add it to the fields object.
     */
    None: 0,
    Read: 0b0001,
    ReadWrite: 0b0011,
    Write: 0b0010,
    /**
     * Create also implies ReadWrite permissions.
     * To exclude Write you can do AccessFieldPermissions.Create & ~AccessFieldPermissions.Write OR AccessFieldPermissions.Create ^ AccessFieldPermissions.Write
     */
    Create: 0b0111
} as const;

export type AccessFieldPermissionsType = typeof AccessFieldPermissions;
export type AccessFieldPermission = AccessFieldPermissionsType[keyof AccessFieldPermissionsType];

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document> = {
    role: string,
    filter?: Document,
    fields?: Partial<Record<keyof TSchema, AccessFieldPermission>>,
    fieldsDefault?: AccessFieldPermission,
    create?: boolean,
    delete?: boolean
};

export type AccessConfig<TSchema extends Document = Document> = AccessDefinition<TSchema>[];

export type AccessPayload = Record<string, any>;

export type WithAccessRole<TSchema extends Document> = TSchema & { __mongalayer_role: string | null };

export type AccessDefaults = {
    /**
     * @description Default access field permission for all fields not explicitly defined in the access config. 
     * @default {AccessFieldPermissions.Read}
     */
    fields: AccessFieldPermission,
    /**
     * @description Default create permission for for a collection. 
     * @default {false}
     */
    create: boolean,
    /**
     * @description Default delete permission for for a collection. 
     * @default {false}
     */
    delete: boolean
}

function getValueByPath(obj: Record<string, any>, path: string, nestedProp?: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? nestedProp ? acc[key][nestedProp] : acc[key] : undefined, obj);
}

export abstract class AccessService {
    protected hydratedConfig: AccessConfig;
    protected hydratedConfigMap: Record<string, AccessConfig[number]> = {};

    constructor (
        protected collection: string,
        protected accessData: AccessPayload,
        accessConfig: AccessConfig,
        protected documentSchema: ZodObject,
        public accessDefaults: AccessDefaults
    ) {
        this.hydratedConfig = Array.isArray(accessConfig) ? accessConfig.map(access => ({
            ...access,
            filter: access.filter ? this.hydrateAccessFilter(access.filter) : void 0
        })) : [];
        this.hydratedConfigMap = this.hydratedConfig.reduce((acc, access) => ({ ...acc, [access.role]: access }), {});
    }

    private hydrateAccessFilter (filter: Document): Document {
        const hydratedFilter = structuredClone(filter);

        iteratePrimitives(hydratedFilter, (key, value, replace) => {
            if (typeof value === "string" && value.indexOf("%%") === 0) {
                replace(getValueByPath(this.accessData, value.substring(2)));
            }
        });

        return hydratedFilter;
    }

    protected getAccessFilters (): Filter<Document> | null {
        const filters: Filter<Document>[] = [];

        filters.push(...this.hydratedConfig.map(access => access.filter ?? { }));

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
                            { $match: access.filter ?? { } },
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
}