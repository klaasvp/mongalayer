import z, { ZodType } from "zod/v4"

export interface FilterTests { }

export const filterTestsSchema = z.object({

}) satisfies ZodType<FilterTests>;
