import z, { ZodType } from "zod/v4";

export interface SchemaTest { }

export const schemaTestSchema = z.object({}) satisfies ZodType<SchemaTest>;