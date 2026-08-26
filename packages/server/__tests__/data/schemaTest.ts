import * as z from "zod";
import type { ZodType } from "zod";

export interface SchemaTest { }

export const schemaTestSchema = z.object({}) satisfies ZodType<SchemaTest>;