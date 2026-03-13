import { z } from "zod";
import { filterSchema } from "./query.js";
import { unwindSchema } from "./aggregation/unwind.js";
import { projectionSchema } from "./aggregation/project.js";
import { sortSchema } from "./aggregation/sort.js";
import { groupSchema } from "./aggregation/group.js";
import { searchSchema } from "./aggregation/search.js";

// TODO :: Remove $where / $near / $nearSphere / $text (or allow it only as the first stage)
const matchSchema = filterSchema;

export const skipSchema = z.int().nonnegative();
export const limitSchema = z.int().positive();

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
}));

export type StageSchema =  z.infer<typeof stageSchema>

export type PipelineSchema = StageSchema[];

export const pipelineSchema: z.ZodType<PipelineSchema> = z.array(stageSchema);