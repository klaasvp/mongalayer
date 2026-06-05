import type { Document, MongoClient } from "mongodb";
import { AccessConfig, AccessDefaults, AccessPayload, AccessPermissions } from "../access.js";
import { AccessService } from "../access.js";
import { isLookupStage, PipelineSchema, StageSchema } from "../schema/aggregate.js";
import { KeysOfUnion } from "type-fest";
import { Debugging, MongalayerCollections } from "../core.js";
import z, { ZodObject } from "zod";
import { LookupSchema } from "#src/schema/aggregation/lookup.js";

type AggregationStages = {
    $pipeline: Document[]
}

export class AggregationAccessService<TAccessPayload extends AccessPayload = AccessPayload> extends AccessService {
    constructor (
        protected client: MongoClient,
        protected database: string,
        public readonly collection: string,
        protected accessData: TAccessPayload,
        protected accessConfig: AccessConfig,
        protected documentSchema: ZodObject,
        public accessDefaults: AccessDefaults,
        protected collections: MongalayerCollections<TAccessPayload>
    ) {
        super(client, database, collection, accessData, accessConfig, documentSchema, accessDefaults);
    }

    private addFilterStage (pipeline: Document[] = []): { accessFilterIndex: number, existingFilterIndex: number, firstFilterStage: Document | {} } {
        const accessFilters = this.getAccessFilters();

        if (pipeline.length > 0) {
            const firstStage = Object.keys(pipeline[0])[0] as KeysOfUnion<StageSchema>;

            switch (firstStage) {
                // Insert the $match after the $search ($search always needs to be the first stage)
                case "$search": 
                    if (accessFilters !== null) {
                        pipeline.splice(1, 0, {
                            $match: accessFilters
                        });
                        
                        return { accessFilterIndex: 1, existingFilterIndex: 1, firstFilterStage: {} };
                    } else {
                        return { accessFilterIndex: -1, existingFilterIndex: 0, firstFilterStage: {} };
                    }
                // Merge the first $match with the access filters
                case "$match":
                    const originalMatch = pipeline[0].$match as Document;

                    if (accessFilters !== null) {
                        const $match = Object.keys(originalMatch).length > 0
                            ? { $and: [ accessFilters, originalMatch ] }
                            : accessFilters

                        pipeline[0] = { $match };
                        
                        return { accessFilterIndex: 0, existingFilterIndex: 0, firstFilterStage: originalMatch };
                    } else {
                        return { accessFilterIndex: -1, existingFilterIndex: 0, firstFilterStage: originalMatch };
                    }
                // If not filter is available as the first stage, insert it
                default: 
                    if (accessFilters !== null) {
                        pipeline.unshift({
                            $match: accessFilters
                        });

                        return { accessFilterIndex: 0, existingFilterIndex: -1, firstFilterStage: {} };
                    }
            }
        }

        return { accessFilterIndex: -1, existingFilterIndex: -1, firstFilterStage: {} };
    }

    public getStages (currentPipeline: PipelineSchema = [], isNested = false): AggregationStages {
        const pipeline = structuredClone(currentPipeline) as Document[];

        currentPipeline.forEach((stage, index) => {
            if (isLookupStage(stage)) {
                const lookupStages = this.handleLookupStageAccess(stage.$lookup);

                pipeline[index].$lookup = {
                    ...stage.$lookup,
                    pipeline: lookupStages.$pipeline
                };
            }
        });

        const { accessFilterIndex, existingFilterIndex, firstFilterStage } = this.addFilterStage(pipeline);

        const filterStages = pipeline.splice(0, existingFilterIndex + 1);

        let roleStages: Document[] | null = null;

        if (accessFilterIndex >= 0 || this.hasRolesWithAlternativeAccessCollection) {
            roleStages = this.getRoleStages(firstFilterStage);
        }

        const newPipelineBase = this.getBasePipeline(filterStages, roleStages, isNested);

        if (roleStages !== null) {
            const roleProjection = this.getRoleProjection();

            newPipelineBase.push(...roleProjection); // Add the role projection stages after the role assignment stage
        }

        // Insert the new base pipeline at the beginning of the rest of the original pipeline
        pipeline.splice(0, 0, ...newPipelineBase);

        const stages = {
            $pipeline: pipeline
        };

        return stages;
    }

    private getRoleProjection (): Document[] {
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

        return [{ $facet }, $project, $unwind, $replaceRoot, $removeRole];
    }

    private handleLookupStageAccess (lookupStage: LookupSchema): Document {
        let accessConfig: AccessConfig<Document, AccessPayload> = [], schema: ZodObject = z.object({});
        
        if (this.collections[lookupStage.from] !== void 0) {
            accessConfig = this.collections[lookupStage.from].access as AccessConfig<Document, AccessPayload>;
            schema = this.collections[lookupStage.from].schema;
        } else {
            if (Debugging.isEnabled()) {
                console.debug("Mongalayer - Execute - No config found, using public access");
            }
        }

        const lookupAccessService = new AggregationAccessService<TAccessPayload>(
            this.client, 
            this.database, 
            lookupStage.from, 
            this.accessData, 
            accessConfig, 
            schema, 
            this.accessDefaults, 
            this.collections
        );

        // TODO check localField & foreignField access permissions

        return lookupAccessService.getStages(lookupStage.pipeline ?? [], true);
    }
}