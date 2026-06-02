import z from "zod";

// For now, only supporting the basic form of $lookup, because of the access complexity.
export const lookupSchema = z.strictObject({
    from: z.string(),
    localField: z.string(),
    foreignField: z.string(),
    as: z.string()
});

export type LookupSchema = z.infer<typeof lookupSchema>;