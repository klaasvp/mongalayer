import { z } from "zod/v4";
import { documentSchema, JSONValue } from "./index.js";

export type UpdateSchema = {
    $inc?: Record<string, number | undefined>,
    $unset?: Record<string, "" | true | 1>,
    $set?: Record<string, JSONValue>
}

export const updateSchema: z.ZodType<UpdateSchema> = 
    z.strictObject({
        $inc: z.record(z.string(), z.number().optional()),
        $unset: z.record(z.string(), z.union([z.literal(""), z.literal(true), z.literal(1)])),
        $set: documentSchema
    }).partial().refine((data) => Object.keys(data).length > 0, {
        message: "Update document requires at least one atomic operator"
    });