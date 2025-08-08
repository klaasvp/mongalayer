import z from "zod/v4"

export type Sort = { [key: string]: -1 | 1 | { $meta: "textScore" } }

export const sortSchema = z.record(z.string(), z.union([z.literal(-1), z.literal(1), z.strictObject({ $meta: z.literal("textScore") })])).refine(obj => Object.keys(obj).length > 0) as z.ZodType<Sort>