import type { Filter, Document } from "mongodb";
import { AccessService } from "../access.js";

export type PreloadRoleStages = {
    $pipeline: Document[],
    usingRoles: boolean
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
        const filterStage = this.getFilterStage(currentFilter), roleStages = this.getRoleStages(currentFilter);

        // After this stage, the documents are in the same state as if we would have run a find query with the filterStage as the filter

        const stages = {
            $pipeline: this.getBasePipeline([filterStage], roleStages),
            usingRoles: roleStages !== null
        };

        return stages;
    };
}