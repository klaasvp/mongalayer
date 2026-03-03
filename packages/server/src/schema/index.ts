import { z } from "zod";
import { iteratePrimitives } from "@mongalayer/core";

export type Projection = { [key: string]: 0 | 1 | boolean | Projection }

// MongoDB also support certain operators for projection, we don't support that yet.
export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema]))).check((ctx) => {
    let firstProjectionType: 0 | 1 | undefined = undefined;
    
    iteratePrimitives(ctx.value, (key, value, replace) => {
        if (key !== "_id") {
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

export type Sort = { [key: string]: -1 | 1 }

export const sortSchema = z.record(z.string(), z.union([z.literal(-1), z.literal(1)])) as z.ZodType<Sort>

export const keyWithoutDollar = z.string().regex(/^[^\$]/);

export type JSONValue = string | number | boolean | null | Date | { [key: string]: JSONValue } | JSONValue[];

export const documentValueSchema: z.ZodType<JSONValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.date(),
    //z.undefined() -> JSON which will be the payload does not support undefined,
    z.array(documentValueSchema),
    z.record(keyWithoutDollar, documentValueSchema)
]))

export const documentSchema = z.record(keyWithoutDollar, documentValueSchema);