import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "./utils/replacer.js";

export const AccessFieldPermissions = {
    None: "x",
    Read: "r",
    Write: "w"
} as const;

function getValueByPath(obj: Record<string, any>, path: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
}

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document> = {
    role: string,
    filter?: Filter<TSchema>,
    fields?: Record<keyof TSchema, typeof AccessFieldPermissions>,
    delete?: boolean
};

export type AccessConfig<TSchema extends Document = Document> = AccessDefinition<TSchema>[];

export type AccessPayload = Record<string, any>;

export class AccessService {
    constructor (
        private accessData: AccessPayload,
        private accessConfig: AccessConfig
    ) {
    }

    private hydrateAccessFilter (filter: Filter<Document>): Filter<Document> {
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

        filters.push(...this.accessConfig.filter(access => access.filter !== void 0).map(access => this.hydrateAccessFilter(access.filter!)));

        if (filters.length === 0) return null;

        return { $or: filters };
    }

    public getFilter (currentFilter: Filter<Document> = {}): Filter<Document> {
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
}