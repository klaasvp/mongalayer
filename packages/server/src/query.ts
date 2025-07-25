import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "./utils/replacer.js";
import { ZodObject } from "zod/v4";
import { AccessConfig, AccessFieldPermission, AccessPayload } from "./access.js";
import { hasNearQuery, transformNearToGeoNear } from "./query/near.js";

type QueryStages = {
    $query: Document,
    $role: { $addFields: Document } | null
}

function getValueByPath(obj: Record<string, any>, path: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
}

export class QueryService {
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

        // Behind the scenes we use aggregations, those don't support $near & $nearSphere but we can transform them to $geoNear
        // TODO :: Handle multiple $near or $nearSphere operators (for instance when using a $or root level operator)
        const nearResult = hasNearQuery(currentFilter);
        if (nearResult) {
            const $geoNear = transformNearToGeoNear(currentFilter, nearResult);

            if (accessFilters !== null) {
                $geoNear.query = $geoNear.query === void 0
                    ? accessFilters
                    : { $and: [ accessFilters, $geoNear.query ] };
            }

            return { $geoNear };
        } else {
            // Only add the access filter $and condition when there are access filters defined.
            return accessFilters !== null
                ? { $match: { $and: [ accessFilters, currentFilter ] } }
                : { $match: currentFilter };
        }
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
        const role = this.getRole();

        const stages = {
            $query: this.getFilter(currentFilter),
            $role: role ? { $addFields: role } : null
        };

        return stages;
    };

    public processFields <TSchema extends Document> (doc: TSchema): Partial<TSchema> {
        delete doc.__mongalayer_role;
        delete doc.__mongalayer_geonear_distance;

        return doc;
    }
}