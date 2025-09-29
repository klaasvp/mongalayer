import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "@mongalayer/core";
import { AccessPermissions } from "../access.js";
import { hasNearQuery, transformNearToGeoNear } from "../query/near.js";
import { deleteObjectProperty, isObject } from "@mongalayer/core";
import { AccessService } from "../access.js";

export type PreloadRoleStages = {
    $query: Document,
    $role: Document[] | null
}

export class PreloadRoleAccessService extends AccessService {
    private getFilterStage (currentFilter: Filter<Document> = {}): Filter<Document> {
        const accessFilters = this.getAccessFilters();

        // Only add the access filter $and condition when there are access filters defined.
        return accessFilters !== null
            ? { $match: { $and: [ accessFilters, currentFilter ] } }
            : { $match: currentFilter };
    }

    public getStages (currentFilter: Filter<Document> = {}): PreloadRoleStages {
        const role = this.getRoleStages();

        const stages = {
            $query: this.getFilterStage(currentFilter),
            $role: role ? role : null
        };

        return stages;
    };
}