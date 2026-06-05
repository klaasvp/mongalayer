import type { Filter, Document } from "mongodb";
import { hasNearQuery, transformNearToGeoNear } from "../query/near.js";
import { AccessService } from "../access.js";

type QueryStages = {
    $pipeline: Document[],
    $project: { $project: Document } | null,
    usingRoles: boolean
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
        const filterStage = this.getFilterStage(currentFilter), roleStages = this.getRoleStages(currentFilter);

        // After this stage, the documents are in the same state as if we would have run a find query with the filterStage as the filter

        const project = this.getProjection(projection)

        const stages = {
            $pipeline: this.getBasePipeline([filterStage], roleStages),
            $project: project ? { $project: project } : null,
            usingRoles: roleStages !== null
        };

        return stages;
    };
}