import z from "zod/v4";
import { $geometryBoundsSchema, $geometryNearSchema, positionSchema } from "../schema/geo.js";
import { BSONTypeAliasSchema, BSONTypeSchema } from "../schema/bson.js";

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

const operatorKeys = [
    "$eq", "$gt", "$gte", "$in", "$lt", "$lte", "$ne", "$nin", "$not", 
    "$exists", "$type", "$jsonSchema", "$mod", "$regex", "$options", "$all", "$elemMatch", "$size",
    "$bitsAllClear", "$bitsAllSet", "$bitsAnyClear", "$bitsAnySet", "$rand", 
    "$geoIntersects", "$geoWithin", "$near", "$nearSphere", "$maxDistance" 
];

const rootOperatorKeys = [ "$text", "$and", "$or", "$nor" ];

const withoutOperatorKeys = z.string().regex(/^[^$]/);

/*export const documentScalarSchema = z.union([
    
]);*/

export const documentValueSchema = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    //z.undefined() -> JSON which will be the payload does not support undefined,
    z.array(documentValueSchema),
    z.record(withoutOperatorKeys, documentValueSchema)
])) as z.ZodType<JSONValue>;

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
    get $jsonSchema(): z.ZodLazy<typeof documentSchema> { return z.lazy(() => documentSchema) },
    $mod: z.tuple([ z.number(), z.number() ]),
    $regex: z.union([
        // z.instanceof(RegExp), -> RegExp not supported yet
        z.string()
    ]),
    $options: z.string(),
    $geoIntersects: z.strictObject({
        $geometry: $geometryBoundsSchema
    }),
    $geoWithin: z.union([
        z.strictObject({
            $geometry: $geometryBoundsSchema
        }),
        z.strictObject({
            $box: z.tuple([ positionSchema, positionSchema ]),
            $polygon: z.array(positionSchema),
            $center: z.tuple([ positionSchema, z.number() ]),
            $centerSphere: z.tuple([ positionSchema, z.number() ])
        }).partial()
    ]),
    $near: z.union([
        positionSchema,
        $geometryNearSchema
    ]),
    $nearSphere: z.union([
        positionSchema,
        $geometryNearSchema
    ]),
    $maxDistance: z.number(),
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

/*
export declare type Filter<TSchema> = {
    [P in keyof WithId<TSchema>]?: Condition<WithId<TSchema>[P]>;
} & RootFilterOperators<WithId<TSchema>>;
*/
export const filterSchema = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array().min(1)) },
        get $nor (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array().min(1)) },
        get $or (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array().min(1)) },
        // $expr: documentSchema, -> $expr not supported yet, this is a highly complex one
        $expr: z.never(),
        // No additional properties allowed here
        $text: z.strictObject({
            $search: z.string(),
            $language: z.string().optional(),
            $caseSensitive: z.boolean().optional(),
            $diacriticSensitive: z.boolean().optional()
        })
        // $where is excluded
        // $comment is excluded
    }).partial().catchall(documentValueSchema.or(filterOperatorsSchema)).refine(
        (data) => Object.keys(data).every(key => !key.startsWith("$") || rootOperatorKeys.includes(key)),
        { message: "Invalid filter root operator" }
    )

type Test1 = z.infer<typeof filterSchema>

export type Projection = { [key: string]: 0 | 1 | boolean | Projection }

export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema]))) as z.ZodType<Projection>
