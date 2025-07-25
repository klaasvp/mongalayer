import { z } from "zod/v4";

type Crs = { crs?: { type: "name", properties: { name: string } } };

type Position = [number, number];
type Point = { type: "Point", coordinates: Position };
type MultiPoint = { type: "MultiPoint", coordinates: Position[] };
type LineString = { type: "LineString", coordinates: Position[] };
type MultiLineString = { type: "MultiLineString", coordinates: Position[][] };
type Polygon = { type: "Polygon", coordinates: Position[][] } & Crs;
type MultiPolygon = { type: "MultiPolygon", coordinates: Position[][][] } & Crs;

type Geometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon;
type GeometryCollection = { type: "GeometryCollection", geometries: Geometry[] };
type GeometryNearSchema = { $geometry: Point, $maxDistance?: number, $minDistance?: number };

// [longitude, latitude]
export const positionSchema = z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
]) as z.ZodType<Position>;

// Geometry types
export const pointSchema = z.strictObject({
    type: z.literal("Point"),
    coordinates: positionSchema
}) as z.ZodType<Point>

export const multiPointSchema = z.strictObject({
    type: z.literal("MultiPoint"),
    coordinates: z.array(positionSchema)
}) as z.ZodType<MultiPoint>;

export const lineStringSchema = z.strictObject({
    type: z.literal("LineString"),
    coordinates: z.array(positionSchema)
}) as z.ZodType<LineString>;

export const multiLineStringSchema = z.strictObject({
    type: z.literal("MultiLineString"),
    coordinates: z.array(z.array(positionSchema))
}) as z.ZodType<MultiLineString>;

const checkClosedLoop = (positions: Position[]): boolean => {
    const first = positions[0], last = positions[positions.length - 1];

    return first[0] === last[0] && first[1] === last[1];
};

const crsProperty = z.strictObject({
    crs: z.strictObject({
        type: z.literal("name"),
        properties: z.object({
            name: z.string()
        })
    }).optional()
});

export const polygonSchema = z.array(positionSchema).min(3);
export const geometryPolygonSchema = z.array(polygonSchema.refine(checkClosedLoop)).min(1);

export const geoPolygonTypeSchema = z.strictObject({
    type: z.literal("Polygon"),
    coordinates: geometryPolygonSchema,
    ...crsProperty.shape
}) as z.ZodType<Polygon>;

export const geoMultiPolygonTypeSchema = z.strictObject({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(geometryPolygonSchema).min(1),
    ...crsProperty.shape
}) as z.ZodType<MultiPolygon>;

// GeometryCollection
const geometrySchema = z.union([
    pointSchema,
    multiPointSchema,
    lineStringSchema,
    multiLineStringSchema,
    geoPolygonTypeSchema,
    geoMultiPolygonTypeSchema
]) as z.ZodType<Geometry>;

const geometryCollectionSchema = z.strictObject({
    type: z.literal("GeometryCollection"),
    geometries: z.array(geometrySchema)
}) as z.ZodType<GeometryCollection>;

// Top-level GeoJSON object
export const geoJSONSchema = geometrySchema.or(geometryCollectionSchema);

export const coordinatesSchema = z.union([
    positionSchema,
    z.record(z.string(), z.number()).refine((value) => positionSchema.safeParse(Object.values(value)).success, { error: "Object must have exactly 2 properties" })
]);

export const $geometryIntersectsSchema = geometrySchema.or(geometryCollectionSchema).or(positionSchema)

export const $geometryWithinSchema = z.union([
    geoPolygonTypeSchema,
    geoMultiPolygonTypeSchema,
    geometryCollectionSchema
]);

export const $geometryNearSchema = z.strictObject({
    $geometry: pointSchema,
    $minDistance: z.number().gt(0).optional(),
    $maxDistance: z.number().gt(0).optional()
}).check((ctx) => {
    if (ctx.value.$minDistance && ctx.value.$maxDistance && ctx.value.$minDistance > ctx.value.$maxDistance) {
        ctx.issues.push({
            code: "too_big",
            maximum: ctx.value.$maxDistance,
            origin: "$minDistance",
            message: "$minDistance can't be larger than $maxDistance",
            input: ctx.value
        })
    }
}) as z.ZodType<GeometryNearSchema>;