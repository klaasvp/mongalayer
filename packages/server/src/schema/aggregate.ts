import { z } from "zod";
import { unwindSchema } from "./aggregation/unwind.js";
import { projectionSchema } from "./aggregation/project.js";
import { sortSchema } from "./aggregation/sort.js";
import { groupSchema } from "./aggregation/group.js";
import { searchSchema } from "./aggregation/search.js";
import { LookupSchema, lookupSchema } from "./aggregation/lookup.js";
import { limitSchema, matchSchema, skipSchema } from "./aggregation/index.js";


export const stageSchema = z.strictObject({ // Not strict as it's combined with documentSchema
    $match: matchSchema
}).or(z.strictObject({
    $project: projectionSchema
})).or(z.strictObject({
    $sort: sortSchema
})).or(z.strictObject({
    $skip: skipSchema
})).or(z.strictObject({
    $limit: limitSchema
})).or(z.strictObject({
    $unwind: unwindSchema
})).or(z.strictObject({
    $group: groupSchema
})).or(z.strictObject({
    $search: searchSchema
})).or(z.strictObject({
    $lookup: lookupSchema
}));

export type StageSchema =  z.infer<typeof stageSchema>

export type PipelineSchema = StageSchema[];

export const pipelineSchema: z.ZodType<PipelineSchema> = z.array(stageSchema);

export const isLookupStage = (stage: StageSchema): stage is { $lookup: LookupSchema } => {
    return stage.hasOwnProperty("$lookup");
};