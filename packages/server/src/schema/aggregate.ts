import { z } from "zod/v4";
import { filterSchema } from "./query.js";
import { unwindSchema } from "./aggregation/unwind.js";
import { projectionSchema } from "./aggregation/project.js";
import { sortSchema } from "./aggregation/sort.js";
import { groupSchema } from "./aggregation/group.js";

const stageKeys = [
    "$match", "$project", "$sort"
];

// TODO :: Remove $where / $near / $nearSphere / $text (or allow it only as the first stage)
const matchSchema = filterSchema;

export const stageSchema = z.strictObject({ // Not strict as it's combined with documentSchema
    $match: matchSchema
}).or(z.strictObject({
    $project: projectionSchema
})).or(z.strictObject({
    $sort: sortSchema
})).or(z.strictObject({
    skip: z.int().positive()
})).or(z.strictObject({
    limit: z.int().positive()
})).or(z.strictObject({
    $unwind: unwindSchema
})).or(z.strictObject({
    $group: groupSchema
}));

export type StageSchema =  z.infer<typeof stageSchema>

export type PipelineSchema = StageSchema[];

export const pipelineSchema: z.ZodType<PipelineSchema> = z.array(stageSchema);