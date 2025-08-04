import z from "zod/v4";

export const unwindSchema = z.strictObject({
    path: z.string(),
    includeArrayIndex: z.string().optional(),
    preserveNullAndEmptyArrays: z.boolean().optional()
});