import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core";
import { AccessPermissions } from "../access.js";
import { hasNearQuery, transformNearToGeoNear } from "../query/near.js";
import { deleteObjectProperty, isObject } from "@mongalayer/core";
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
}