import type { Filter, Document } from "mongodb";
import { AccessService } from "../access.js";

export type PreloadRoleStages = {
    $pipeline: Document[],
    usingRoles: boolean
}

export class PreloadRoleAccessService extends AccessService {
    private getFilterStages (currentFilter: Filter<Document> = {}): Filter<Document>[] {
        const accessFilters = this.getAccessFilters();

        // Only add the access filter $and condition when there are access filters defined.
        if (accessFilters !== null) {
            const stages: Filter<Document>[] = [{ $match: { $and: [ accessFilters, currentFilter ] } }];

            const localRoleStage = this.getLocalRoleStage();
            
            if (localRoleStage) {
                stages.push(localRoleStage);
            }

            return stages;
        }

        return [{ $match: currentFilter }];
    }

    public getStages (currentFilter: Filter<Document> = {}): PreloadRoleStages {
        const filterStage = this.getFilterStages(currentFilter), roleStages = this.getRoleStages();

        // After this stage, the documents are in the same state as if we would have run a find query with the filterStage as the filter

        const stages = {
            $pipeline: this.getBasePipeline(filterStage, roleStages),
            usingRoles: roleStages !== null
        };

        return stages;
    };
}