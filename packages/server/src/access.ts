import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "./utils/replacer.js";
import { ZodObject } from "zod/v4";

export const AccessFieldPermissions = {
    /**
     * Note: This does not exclude the _id field. If you want to exclude the _id field, you need to add it to the fields object.
     */
    None: "x",
    Read: "r",
    Write: "w"
} as const;

export type AccessFieldPermissionsType = typeof AccessFieldPermissions;
export type AccessFieldPermission = AccessFieldPermissionsType[keyof AccessFieldPermissionsType];

function getValueByPath(obj: Record<string, any>, path: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
}

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document> = {
    role: string,
    filter?: Document,
    fields?: Record<keyof TSchema, AccessFieldPermission>,
    fieldsDefault?: AccessFieldPermission,
    delete?: boolean
};

export type AccessConfig<TSchema extends Document = Document> = AccessDefinition<TSchema>[];

export type AccessPayload = Record<string, any>;

type QueryStages = {
    $match: Document,
    $role: Document | null
}

export class AccessService {
    private hydratedConfig: AccessConfig;

    constructor (
        private accessData: AccessPayload,
        accessConfig: AccessConfig,
        private documentSchema: ZodObject,
        private accessFieldsDefault: AccessFieldPermission
    ) {
        this.hydratedConfig = accessConfig.map(access => ({
            ...access,
            filter: access.filter ? this.hydrateAccessFilter(access.filter) : void 0
        }));
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

    private buildAccessFilters (): Filter<Document> | null {
        const filters: Filter<Document>[] = [];

        filters.push(...this.hydratedConfig.filter(access => access.filter !== void 0).map(access => ({ $expr: access.filter })));

        if (filters.length === 0) return null;

        return { $or: filters };
    }

    private getFilter (currentFilter: Filter<Document> = {}): Filter<Document> {
        const accessFilters = this.buildAccessFilters();

        // Only add the access filter $and condition when there are access filters defined.
        if (accessFilters !== null) {
            return {
                $and: [
                    accessFilters,
                    currentFilter
                ]
            };
        }

        return currentFilter;
    }

    private getRole (): Document | null {
        if (this.hydratedConfig.length > 0) {
            return { 
                __mongalayer_role: {
                    $switch: {
                        branches: this.hydratedConfig.map(access => ({
                            case: access.filter!,
                            then: access.role
                        })),
                        default: null
                    }
                }
            }
        }

        return null;
    }

    public getStages (currentFilter: Filter<Document> = {}): QueryStages {
        const stages = {
            $match: this.getFilter(currentFilter),
            $role: this.getRole()
        };

        return stages;
    };

    public processFields <TSchema extends Document> (doc: TSchema): Partial<TSchema> {
        delete doc.__mongalayer_role;

        return doc;
    }
}

export type WithAccessRole<TSchema extends Document> = TSchema & { __mongalayer_role: string | null };