import z from "zod";

/**
 * MongoDB - 6.17.0
 */
import type { BSONTypeAlias } from "mongodb";

export const BSONTypeAliasSchema = z.union([
    z.literal("string"),
    z.literal("symbol"),
    z.literal("undefined"),
    z.literal("object"),
    z.literal("array"),
    z.literal("int"),
    z.literal("null"),
    z.literal("date"),
    z.literal("double"),
    z.literal("binData"),
    z.literal("objectId"),
    z.literal("bool"),
    z.literal("regex"),
    z.literal("dbPointer"),
    z.literal("javascript"),
    z.literal("javascriptWithScope"),
    z.literal("timestamp"),
    z.literal("long"),
    z.literal("decimal"),
    z.literal("minKey"),
    z.literal("maxKey")
]) as z.ZodType<BSONTypeAlias>;