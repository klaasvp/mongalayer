import type { Document } from "mongodb";
import { AccessPermissions } from "../access.js";
import { AccessService } from "../access.js";
import { PipelineSchema, StageSchema } from "../schema/aggregate.js";
import { KeysOfUnion } from "type-fest";

type AggregationStages = {
    $pipeline: Document[]
}

export class AggregationAccessService extends AccessService {
    private addFilterStage (pipeline: Document[] = []): { accessFilterIndex: number, firstFilterStage: Document | {} } {
        const accessFilters = this.getAccessFilters();

        // Only add the access filter $and condition when there are access filters defined.
        if (accessFilters !== null && pipeline.length > 0) {
            const firstStage = Object.keys(pipeline[0])[0] as KeysOfUnion<StageSchema>;

            switch (firstStage) {
                // Insert the $match after the $search ($search always needs to be the first stage)
                case "$search": 
                    pipeline.splice(1, 0, {
                        $match: accessFilters
                    });
                    
                    return { accessFilterIndex: 1, firstFilterStage: {} };
                // Merge the first $match with the access filters
                case "$match":
                    const originalMatch = pipeline[0].$match as Document;

                    const $match = Object.keys(originalMatch).length > 0
                        ? { $and: [ accessFilters, originalMatch ] }
                        : accessFilters

                    pipeline[0] = { $match };
                    
                    return { accessFilterIndex: 0, firstFilterStage: originalMatch };
                // If not filter is available as the first stage, insert it
                default: 
                    pipeline.unshift({
                        $match: accessFilters
                    });

                    return { accessFilterIndex: 0, firstFilterStage: {} };
            }
        }

        return { accessFilterIndex: -1, firstFilterStage: {} };
    }

    public getStages (currentPipeline: PipelineSchema = []): AggregationStages {
        const pipeline = structuredClone(currentPipeline) as Document[];

        const { accessFilterIndex, firstFilterStage } = this.addFilterStage(pipeline);

        if (accessFilterIndex >= 0 || this.hasRolesWithAlternativeAccessCollection) {
            const roleStages = this.getRoleStages(firstFilterStage);

            if (roleStages !== null) {
                pipeline.splice(accessFilterIndex + 1, 0, ...roleStages);

                const roleProjectionStartIndex = accessFilterIndex + 1 + roleStages.length;

                this.addRoleProjection(pipeline, roleProjectionStartIndex);
            }
        }

        const stages = {
            $pipeline: pipeline
        };

        return stages;
    };

    private addRoleProjection (pipeline: Document[], startIndex: number): void {
        const $facet: Record<string, Document[]> = {};

        for (const roleConfig of this.hydratedConfig) {
            $facet[roleConfig.role] = [{
                $match: { __mongalayer_role: roleConfig.role }
            }];

            // Set the projection if necessary
            const { fields, document } = { 
                fields: {}, 
                document: this.accessDefaults.document,
                ...roleConfig ?? {}
            }

            const roleProjection: Record<string, 0 | 1> = {}; // TODO implement

            const hasPermissions = Object.keys(fields).length > 0, hasDefaultReadPermission = (document & AccessPermissions.Read) > 0;

            if (hasPermissions) {
                const rootProperties = this.documentSchema.keyof().options;

                for (const [field, permission] of Object.entries(fields)) {
                    if (rootProperties.includes(field)) {
                        if (typeof permission !== "undefined") {
                            const hasFieldReadPermission = (permission & AccessPermissions.Read) > 0;

                            if (hasDefaultReadPermission && !hasFieldReadPermission) {
                                roleProjection[field] = 0;
                            } else if (!hasDefaultReadPermission && hasFieldReadPermission) {
                                roleProjection[field] = 1;
                            }
                        }
                    } else {
                        throw `Role permission error: field ${field} does not exists on the schema. Note: Only root properties are supported.`
                    }
                }
            }
            // If there are no field permissions and the default permission is none. Only reflect the ID
            else if (!hasDefaultReadPermission) {
                roleProjection._id = 1;
            }

            if (Object.keys(roleProjection).length > 0) {
                $facet[roleConfig.role].push({
                    $project: roleProjection
                });
            }
        }

        const $project = { $project: { docs: { $concatArrays: Object.keys($facet).map(roleKey => `$${roleKey}`) } } };
        const $unwind = { $unwind: "$docs" };
        const $replaceRoot = { $replaceRoot: { newRoot: "$docs" } };
        const $removeRole = { $project: { __mongalayer_role: 0 } };

        pipeline.splice(startIndex, 0, { $facet }, $project, $unwind, $replaceRoot, $removeRole);
    }
}