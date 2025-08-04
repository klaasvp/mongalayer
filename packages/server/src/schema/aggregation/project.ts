import { iteratePrimitives } from "@mongalayer/core/utils/replacer";
import z from "zod/v4";

type ProjectionExpression = string | { [key: string]: ProjectionExpression } | ProjectionExpression[];

const projectionExpressionSchema: z.ZodType<ProjectionExpression> = z.lazy(() => z.union([z.string(), z.record(z.string(), projectionExpressionSchema), z.array(projectionExpressionSchema)]));

export type Projection = { [key: string]: 0 | 1 | boolean | Projection | ProjectionExpression }

// The aggregation projection only supports projecting other fields & string values in the projection expression
export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema, projectionExpressionSchema]))).check((ctx) => {
    let firstProjectionType: 0 | 1 | undefined = undefined;
    
    iteratePrimitives(ctx.value, (key, value, replace) => {
        if (key !== "_id" && typeof value !== "string") {
            const newValue = !!value ? 1 : 0

            if (firstProjectionType === undefined) {
                firstProjectionType = newValue;
            } else if (firstProjectionType !== newValue) {
                ctx.issues.push({
                    code: "invalid_value",
                    message: "Projection cannot mix inclusion and exclusion.",
                    input: ctx.value,
                    values: []
                });
            }
        }
    });
}) as z.ZodType<Projection>