import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core/utils/replacer";
import { AccessPermissions } from "../access.js";
import { hasNearQuery, transformNearToGeoNear } from "../query/near.js";
import { deleteObjectProperty, isObject } from "@mongalayer/core/utils/object";
import { AccessService } from "../access.js";

type QueryStages = {
    $query: Document,
    $role: Document[] | null
    $project: { $project: Document } | null
}

export class QueryAccessService extends AccessService {
    private getFilterStage (currentFilter: Filter<Document> = {}): Filter<Document> {
        const accessFilters = this.getAccessFilters();

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

    private getProjectionType (projection?: Document): 0 | 1 | null {
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

    private getProjection (projection?: Document): Document | null {
        const projectionType = this.getProjectionType(projection);

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
        const role = this.getRoleStages(), project = this.getProjection(projection);

        const stages = {
            $query: this.getFilterStage(currentFilter),
            $role: role ? role : null,
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