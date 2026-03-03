import z from "zod";

export const unwindSchema = z.string().regex(/^\$/).or(z.strictObject({
    path: z.string().regex(/^\$/),
    includeArrayIndex: z.string().optional(),
    preserveNullAndEmptyArrays: z.boolean().optional()
}));