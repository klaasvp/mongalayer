import { z } from "zod/v4";
import { $geometryIntersectsSchema, $geometryNearSchema, $geometryWithinSchema, polygonSchema, positionSchema } from "../schema/geo.js";
import { BSONTypeAliasSchema, BSONTypeSchema } from "../schema/bson.js";
import { Expression, expressionSchema } from "./expression/index.js";
import { documentValueSchema, JSONValue, keyWithoutDollar } from "./index.js";

const operatorKeys = [
    "$eq", "$gt", "$gte", "$in", "$lt", "$lte", "$ne", "$nin", "$not", 
    "$exists", "$type", "$jsonSchema", "$mod", "$regex", "$options", "$all", "$elemMatch", "$size",
    "$bitsAllClear", "$bitsAllSet", "$bitsAnyClear", "$bitsAnySet", /*"$rand",*/
    "$geoIntersects", "$geoWithin", "$near", "$nearSphere", "$maxDistance", "$minDistance" 
];

const rootOperatorKeys = [ "$text", "$expr", "$and", "$or", "$nor" ]; // $expr
const elemMatchOperatorKeys = [ "$and", "$or", "$nor" ];

const bitwiseSchema = z.union([ 
    z.number(),
    // z.instanceof(Binary), -> Binary not supported yet
    z.array(z.number()).readonly()
]);

const filterOperatorsSchemaBase = z.object({ // Not strict as it's combined with documentSchema
    get $eq (): typeof documentValueSchema { return documentValueSchema },
    get $gt (): typeof documentValueSchema { return documentValueSchema },
    get $gte (): typeof documentValueSchema { return documentValueSchema },
    get $in (): z.ZodArray<typeof documentValueSchema> { return z.array(documentValueSchema) },
    get $lt (): typeof documentValueSchema { return documentValueSchema },
    get $lte (): typeof documentValueSchema { return documentValueSchema },
    get $ne (): typeof documentValueSchema { return documentValueSchema },
    get $nin (): z.ZodArray<typeof documentValueSchema> { return z.array(documentValueSchema) },
    get $not (): z.ZodLazy<typeof filterOperatorsSchemaExcludingNot> {
        // z.instanceof(RegExp) excluded -> RegExp not supported yet

        // Where omitting $not from the schema to avoid infinite recursion
        return z.lazy(() => filterOperatorsSchemaExcludingNot);
    },
    $exists: z.boolean(),
    $type: z.union([
        BSONTypeSchema,
        BSONTypeAliasSchema
    ]),
    // The $mod expression rounds decimal input towards zero. (So min 1 for the divisor to avoid division by zero)
    $mod: z.tuple([ z.number().min(1), z.number() ]),
    $regex: z.union([
        // z.instanceof(RegExp), -> RegExp not supported yet
        z.string()
    ]),
    $options: z.string().regex(/^(?!.*(.).*\1)[imsxu]*$/),
    $geoIntersects: z.strictObject({
        $geometry: $geometryIntersectsSchema
    }),
    $geoWithin: z.union([
        z.strictObject({ $geometry: $geometryWithinSchema }),
        z.strictObject({ $box: z.tuple([ positionSchema, positionSchema ]) }),
        z.strictObject({ $polygon: polygonSchema }),
        z.strictObject({ $center: z.tuple([ positionSchema, z.number() ]) }),
        z.strictObject({ $centerSphere: z.tuple([ positionSchema, z.number() ]) })
    ]),
    $near: z.union([
        positionSchema,
        $geometryNearSchema
    ]),
    $nearSphere: z.union([
        positionSchema,
        $geometryNearSchema
    ]),
    $minDistance: z.number().gt(0),
    $maxDistance: z.number().gt(0),
    // Keep it basic for now
    get $all(): z.ZodArray<typeof documentValueSchema> { return z.array(documentValueSchema) },
    get $elemMatch(): z.ZodLazy<typeof filterOperatorsSchemaExcludingElemMatch | typeof elemMatchFilterSchema> { 
        return z.lazy(() => z.union([
            elemMatchFilterSchema,
            filterOperatorsSchemaExcludingElemMatch
        ])) 
    },
    $size: z.number(),
    $bitsAllClear: bitwiseSchema,
    $bitsAllSet: bitwiseSchema,
    $bitsAnyClear: bitwiseSchema,
    $bitsAnySet: bitwiseSchema,
    //$rand: z.strictObject({})
}).partial();

export const filterOperatorsSchema = filterOperatorsSchemaBase.catchall(documentValueSchema).refine(
    (data) => Object.keys(data).every(key => !key.startsWith("$") || operatorKeys.includes(key)),
    { message: "Invalid filter operator" }
)

const filterOperatorsSchemaExcludingNot = filterOperatorsSchemaBase.omit({ $not: true }).catchall(documentValueSchema).refine(
    (data) => Object.keys(data).every(key => !key.startsWith("$") || (key !== "$not" && operatorKeys.includes(key))),
    { message: "Invalid filter operator" }
)

const filterOperatorsSchemaExcludingElemMatch = filterOperatorsSchemaBase.omit({ $elemMatch: true }).catchall(documentValueSchema).refine(
    (data) => Object.keys(data).every(key => !key.startsWith("$") || (key !== "$elemMatch" && operatorKeys.includes(key))),
    { message: "Invalid filter operator" }
)

// Simplified version of Filter<TSchema> from mongodb
export type FilterSchemaBase = {
    $and?: FilterSchema[],
    $nor?: FilterSchema[],
    $or?: FilterSchema[],
} & {
    [prop: string]: JSONValue | z.infer<typeof filterOperatorsSchema>
}

export type FilterSchema = FilterSchemaBase & {
    $expr?: Expression,
    $text?: {
        $search: string,
        $language?: string,
        $caseSensitive?: boolean,
        $diacriticSensitive?: boolean
    },
    $where?: never,
    $jsonSchema?: never
}

export const filterSchemaArray: z.ZodType<FilterSchema[]> = z.lazy(() => z.array(filterSchema).min(1));
export const filterSchema = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and () { return filterSchemaArray },
        get $nor () { return filterSchemaArray },
        get $or () { return filterSchemaArray },
        $expr: expressionSchema, // -> this is a highly complex one, only a handfull of operators are supported for now
        //get $jsonSchema(): z.ZodLazy<typeof documentSchema> { return z.lazy(() => documentSchema) },
        $jsonSchema: z.never(), // Not supported yet
        // No additional properties allowed here
        $text: z.strictObject({
            $search: z.string(),
            $language: z.string().optional(),
            $caseSensitive: z.boolean().optional(),
            $diacriticSensitive: z.boolean().optional()
        }),
        // $where is excluded
        $where: z.never(),
        // $comment is excluded
    }).partial().catchall(z.union([
        documentValueSchema,
        filterOperatorsSchema
    ])).refine(
        (data) => Object.keys(data).every(key => !key.startsWith("$") || rootOperatorKeys.includes(key)),
        { message: "Invalid filter root operator" }
    )

export const elemMatchFilterSchemaArray: z.ZodType<FilterSchema[]> = z.lazy(() => z.array(elemMatchFilterSchema).min(1));
export const elemMatchFilterSchema: z.ZodType<FilterSchemaBase> = 
    z.object({
        get $and () { return elemMatchFilterSchemaArray },
        get $nor () { return elemMatchFilterSchemaArray },
        get $or () { return elemMatchFilterSchemaArray },
    }).partial().catchall(z.union([
        documentValueSchema,
        filterOperatorsSchema
    ])).refine(
        (data) => Object.keys(data).every(key => !key.startsWith("$") || elemMatchOperatorKeys.includes(key)),
        { message: "Invalid filter root operator" }
    )