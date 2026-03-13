import z, { ZodType } from "zod";

export interface SchemaTest { }

export const schemaTestSchema = z.object({}) satisfies ZodType<SchemaTest>;