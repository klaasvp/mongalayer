import z from "zod";
import { accumulatorsSchema, Expression, expressionSchema, expressionSchemaWithEmptyObject } from "../expression/index.js";

export type Group = {
    _id: Expression | null,
} & ({} | Record<string, z.infer<typeof accumulatorsSchema>>);

// The aggregation projection only supports projecting other fields & string values in the projection expression
export const groupSchema: z.ZodType<Group> = z.object({
    _id: expressionSchemaWithEmptyObject.nullable(),
}).catchall(accumulatorsSchema);