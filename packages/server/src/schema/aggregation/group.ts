import z from "zod/v4";
import { $first, $firstN, $last, $lastN, Expression, expressionSchema } from "../expression/index.js";

/**
 * No all accumulators are supported yet.
 * 
 * See:
 * https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/#accumulator-operator
 */
const accumulatorsSchema = z.strictObject({ $avg: expressionSchema })
.or(z.strictObject({ $count: z.strictObject({}) }))
.or($first)
.or($firstN)
.or($last)
.or($lastN)
.or(z.strictObject({ $max: expressionSchema }))
.or(z.strictObject({ $median: z.strictObject({ input: expressionSchema, method: z.literal("approximate") }) }))
.or(z.strictObject({ $min: expressionSchema }))
.or(z.strictObject({ $sum: expressionSchema }));

export type Group = {
    _id: Expression | null,
} & {
    [key: string]: z.infer<typeof accumulatorsSchema>
}

// The aggregation projection only supports projecting other fields & string values in the projection expression
export const groupSchema: z.ZodType<Group> = z.object({
    _id: expressionSchema.nullable(),
}).catchall(accumulatorsSchema);