import z from "zod";
import { projectionSchema } from "./project.js";
import { limitSchema, matchSchema, skipSchema } from "./index.js";

// For now, only supporting the basic form of $lookup, because of the access complexity.
export const lookupSchema = z.strictObject({
    from: z.string(),
    localField: z.string(),
    foreignField: z.string(),
    pipeline: z.array(
        z.strictObject({
            $match: matchSchema
        }).or(z.strictObject({
            $project: projectionSchema
        })).or(z.strictObject({
            $skip: skipSchema
        })).or(z.strictObject({
            $limit: limitSchema
        }))
    ).optional(),
    as: z.string()
});

export type LookupSchema = z.infer<typeof lookupSchema>;