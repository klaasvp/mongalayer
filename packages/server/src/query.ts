import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "./utils/replacer.js";
import { ZodObject } from "zod/v4";
import { AccessConfig, AccessFieldPermission, AccessFieldPermissions, AccessPayload } from "./access.js";
import { hasNearQuery, transformNearToGeoNear } from "./query/near.js";
import { deleteObjectProperty, isObject } from "./utils/core.js";

type QueryStages = {
    $query: Document,
    $role: { $addFields: Document } | null
    $project: { $project: Document } | null
}

function getValueByPath(obj: Record<string, any>, path: string, nestedProp?: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? nestedProp ? acc[key][nestedProp] : acc[key] : undefined, obj);
}

export class QueryService {
    private hydratedConfig: AccessConfig;
    private hydratedConfigMap: Record<string, AccessConfig[number]> = {};

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

    private getProjectenType (projection?: Document): 0 | 1 | null {
        if (isObject(projection)) {
            try {
                iteratePrimitives(projection, (key, value, replace, path) => {
                    const projectionValue = !!value ? 1 : 0, isID = key === "_id" && path.length === 1;

                    if (!isID && projectionValue === 0) {
                        throw "exit";
                    }
                });

                return 1;
            } catch (e) {
                if (e !== "exit") throw e;

                return 0;
            }
        }

        return null;
    }

    private getProjection (projection?: Document): Document | null {
        const projectionType = this.getProjectenType(projection);

        // We will only allow inclusive projections as a pipeline stage because exclusive ones will break our role & fields system.
        if (projectionType === 1) {
            const finalProjection: Document = Object.assign({}, structuredClone(projection));

            finalProjection.__mongalayer_role = 1;
            finalProjection.__mongalayer_geonear_distance = 1;

            return finalProjection;
        }

        return null;
    }

    public getStages (currentFilter: Filter<Document> = {}, projection?: Document): QueryStages {
        const role = this.getRole(), project = this.getProjection(projection);

        const stages = {
            $query: this.getFilter(currentFilter),
            $role: role ? { $addFields: role } : null,
            $project: project ? { $project: project } : null
        };

        return stages;
    };

    /**
     * Delete the fields in-place
     */
    public processFields <TSchema extends Document> (docs: TSchema[], projection?: Document): Partial<TSchema>[] {
        const pathsToDelete: string[] = [
            "__mongalayer_role",
            "__mongalayer_geonear_distance"
        ]

        const projectionType = this.getProjectenType(projection);

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
            const { fields, fieldsDefault } = { 
                fields: {}, 
                fieldsDefault: this.accessFieldsDefault,
                ...this.hydratedConfigMap[doc.__mongalayer_role] ?? {}
            }

            // Pre-clean the document that need to be delete anyway
            for (const pathToDelete of pathsToDelete) {
                deleteObjectProperty(pathToDelete, doc);
            }

            const remainingKeys = Object.keys(doc).filter(key => key !== "_id");

            for (const key of remainingKeys) {
                const fieldPermission = fields[key] ?? fieldsDefault;
                
                if (fieldPermission === AccessFieldPermissions.None) {
                    delete doc[key];
                }
            }
        }

        return docs;
    }
}