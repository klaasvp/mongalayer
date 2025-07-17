import { z } from "zod/v4";
import { $geometryIntersectsSchema, $geometryNearSchema, $geometryWithinSchema, polygonSchema, positionSchema } from "../schema/geo.js";
import { BSONTypeAliasSchema, BSONTypeSchema } from "../schema/bson.js";

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

const operatorKeys = [
    "$eq", "$gt", "$gte", "$in", "$lt", "$lte", "$ne", "$nin", "$not", 
    "$exists", "$type", "$jsonSchema", "$mod", "$regex", "$options", "$all", "$elemMatch", "$size",
    "$bitsAllClear", "$bitsAllSet", "$bitsAnyClear", "$bitsAnySet", "$rand", 
    "$geoIntersects", "$geoWithin", "$near", "$nearSphere", "$maxDistance", "$minDistance" 
];

const rootOperatorKeys = [ "$text", "$and", "$or", "$nor" ]; // $expr

const withoutOperatorKeys = z.string().regex(/^[^$]/);

export const documentValueSchema: z.ZodType<JSONValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    //z.undefined() -> JSON which will be the payload does not support undefined,
    z.array(documentValueSchema),
    z.record(withoutOperatorKeys, documentValueSchema)
]))

export const documentSchema = z.record(withoutOperatorKeys, documentValueSchema);

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
    get $elemMatch(): z.ZodLazy<typeof documentSchema> { return z.lazy(() => documentSchema) },
    $size: z.number(),
    $bitsAllClear: bitwiseSchema,
    $bitsAllSet: bitwiseSchema,
    $bitsAnyClear: bitwiseSchema,
    $bitsAnySet: bitwiseSchema,
    $rand: z.strictObject({})
}).partial();

export const filterOperatorsSchema = filterOperatorsSchemaBase.catchall(documentValueSchema).refine(
    (data) => Object.keys(data).every(key => !key.startsWith("$") || operatorKeys.includes(key)),
    { message: "Invalid filter operator" }
)

const filterOperatorsSchemaExcludingNot = filterOperatorsSchemaBase.omit({ $not: true }).catchall(documentValueSchema).refine(
    (data) => Object.keys(data).every(key => !key.startsWith("$") || (key !== "$not" && operatorKeys.includes(key))),
    { message: "Invalid filter operator" }
)

// Simplified version of Filter<TSchema> from mongodb
export type FilterSchema = {
    $and?: FilterSchema[],
    $nor?: FilterSchema[],
    $or?: FilterSchema[],
    $expr?: never,
    $text?: {
        $search: string,
        $language?: string,
        $caseSensitive?: boolean,
        $diacriticSensitive?: boolean
    },
    $where?: never,
    $jsonSchema?: never
} & {
    [prop: string]: JSONValue | typeof filterOperatorsSchema
}

export const filterSchemaArray: z.ZodType<FilterSchema[]> = z.lazy(() => z.array(filterSchema).min(1));

export const filterSchema: z.ZodType<FilterSchema> = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and () { return filterSchemaArray },
        get $nor () { return filterSchemaArray },
        get $or () { return filterSchemaArray },
        // $expr: documentSchema, -> $expr not supported yet, this is a highly complex one
        $expr: z.never(),
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

export type Projection = { [key: string]: 0 | 1 | boolean | Projection }

export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema]))) as z.ZodType<Projection>
