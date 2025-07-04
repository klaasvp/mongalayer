import z from "zod/v4";
import { $geometryBoundsSchema, $geometryNearSchema, positionSchema } from "../schema/geo.js";
import { BSONTypeAliasSchema, BSONTypeSchema } from "../schema/bson.js";

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

export const documentScalarSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    //z.undefined() -> JSON which will be the payload does not support undefined
]);

export const documentValueSchema = z.lazy(() => z.union([
    documentScalarSchema,
    z.array(documentValueSchema),
    z.record(z.string(), documentValueSchema)
])) as z.ZodType<JSONValue>;

export const documentSchema = z.record(z.string(), documentValueSchema);

export const alternativeSchema = z.lazy(() => z.union([
    documentSchema,
    // z.instanceof(RegExp), -> RegExp not supported yet
    z.string(),
    z.array(documentSchema)
]));

const bitwiseSchema = z.union([ 
    z.number(),
    // z.instanceof(Binary), -> Binary not supported yet
    z.array(z.number()).readonly()
]);

export const filterOperatorsSchema = z.object({ // Not strict as it's combined with documentSchema
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
    $jsonSchema: documentSchema,
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
    get $elemMatch(): typeof documentSchema { return documentSchema },
    $size: z.number(),
    $bitsAllClear: bitwiseSchema,
    $bitsAllSet: bitwiseSchema,
    $bitsAnyClear: bitwiseSchema,
    $bitsAnySet: bitwiseSchema,
    $rand: z.strictObject({})
}).partial();

const filterOperatorsSchemaExcludingNot = filterOperatorsSchema.omit({ $not: true });

const filterOperatorsDocumentSchema = filterOperatorsSchema.and(documentSchema);

export const filterConditionSchema = z.record(z.string(), documentValueSchema.or(filterOperatorsDocumentSchema));

export const filterSchema = filterConditionSchema.and(documentSchema).and(
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array()) },
        get $nor (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array()) },
        get $or (): z.ZodLazy<z.ZodArray<typeof filterSchema>> { return z.lazy(() => filterSchema.array()) },
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
    }).partial()
)

export type Projection = { [key: string]: 0 | 1 | boolean | Projection }

export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema]))) as z.ZodType<Projection>
