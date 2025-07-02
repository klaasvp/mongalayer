import z from "zod/v4";

/**
 * MongoDB - 6.17.0
 */
import { BSONType, BSONTypeAlias } from "mongodb";

export const BSONTypeSchema = z.union([
    z.literal(BSONType.double).describe("double"),
    z.literal(BSONType.string).describe("string"),
    z.literal(BSONType.object).describe("object"),
    z.literal(BSONType.array).describe("array"),
    z.literal(BSONType.binData).describe("binData"),
    z.literal(BSONType.undefined).describe("undefined"),
    z.literal(BSONType.objectId).describe("objectId"),
    z.literal(BSONType.bool).describe("bool"),
    z.literal(BSONType.date).describe("date"),
    z.literal(BSONType.null).describe("null"),
    z.literal(BSONType.regex).describe("regex"),
    z.literal(BSONType.dbPointer).describe("dbPointer"),
    z.literal(BSONType.javascript).describe("javascript"),
    z.literal(BSONType.symbol).describe("symbol"),
    z.literal(BSONType.javascriptWithScope).describe("javascriptWithScope"),
    z.literal(BSONType.int).describe("int"),
    z.literal(BSONType.timestamp).describe("timestamp"),
    z.literal(BSONType.long).describe("long"),
    z.literal(BSONType.decimal).describe("decimal"),
    z.literal(BSONType.minKey).describe("minKey"),
    z.literal(BSONType.maxKey).describe("maxKey")
]);

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