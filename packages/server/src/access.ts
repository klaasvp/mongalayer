import { JwtPayload } from "jsonwebtoken";
import { Filter, Document } from "mongodb";

export const AccessFieldPermissions = {
    None: "x",
    Read: "r",
    Write: "w"
} as const;

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

export type AccessPayload = JwtPayload;

export class AccessService {
    constructor (
        private accessData: AccessPayload,
        private accessConfig: AccessConfig
    ) {
    }

    private buildAccessFilters (): Filter<Document> | null {
        const filters: Filter<Document>[] = [];

        // TODO : use access data to build the filters based on the access config.
        filters.push(...this.accessConfig.filter(access => access.filter !== void 0).map(access => access.filter!));

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