import type { WithId, ObjectId } from "mongodb";
import { PreloadRoleAccessService } from "./preloadRole.js";

export type DeletableDocument = WithId<{ __mongalayer_role?: string | null }>;

export class DeleteAccessService extends PreloadRoleAccessService {
    public documentsEligibleForDelete (docs: DeletableDocument[]): ObjectId[] {
        return docs.filter(doc => {
            // If the role is missing, fallback to the default delete policy
            if (doc.__mongalayer_role === void 0 || doc.__mongalayer_role === null) {
                // TODO - check if this is the right way to handle this, if no role match is found, maybe it should fail anyways
                return this.accessDefaults.delete === true; 
            } else {
                const role = this.hydratedConfigMap[doc.__mongalayer_role];

                return role.delete === void 0 
                    ? this.accessDefaults.delete === true
                    : role.delete === true;
            }
        }).map(({ _id }) => _id);
    }
}