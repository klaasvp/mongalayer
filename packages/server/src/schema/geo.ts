import { z } from "zod/v4";

type Position = [number, number];
type Point = { type: "Point", coordinates: Position };
type MultiPoint = { type: "MultiPoint", coordinates: Position[] };
type LineString = { type: "LineString", coordinates: Position[] };
type MultiLineString = { type: "MultiLineString", coordinates: Position[][] };
type Polygon = { type: "Polygon", coordinates: Position[][] };
type MultiPolygon = { type: "MultiPolygon", coordinates: Position[][][] };

type Geometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon;
type GeometryCollection = { type: "GeometryCollection", geometries: Geometry[] };

// [longitude, latitude]
export const positionSchema = z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
]) as z.ZodType<Position>;

// Geometry types
export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: positionSchema
}) as z.ZodType<Point>

export const multiPointSchema = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(positionSchema)
}) as z.ZodType<MultiPoint>;

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(positionSchema)
}) as z.ZodType<LineString>;

export const multiLineStringSchema = z.object({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(positionSchema))
}) as z.ZodType<MultiLineString>;

const checkClosedLoop = (positions: Position[]): boolean => {
    const first = positions[0], last = positions[positions.length - 1];

    return first[0] === last[0] && first[1] === last[1];
};

export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(positionSchema).min(3).refine(checkClosedLoop)).min(1)
}) as z.ZodType<Polygon>;

export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(positionSchema).min(3).refine(checkClosedLoop)).min(1)).min(1)
}) as z.ZodType<MultiPolygon>;

// GeometryCollection
const geometrySchema = z.union([
    pointSchema,
    multiPointSchema,
    lineStringSchema,
    multiLineStringSchema,
    polygonSchema,
    multiPolygonSchema
])as z.ZodType<Geometry>;

const geometryCollectionSchema = z.object({
    type: z.literal("GeometryCollection"),
    geometries: z.array(geometrySchema)
}) as z.ZodType<GeometryCollection>;

// Top-level GeoJSON object
export const geoJSONSchema = geometrySchema.or(geometryCollectionSchema);
export const geoJSONAndCoodinatesSchema = geometrySchema.or(geometryCollectionSchema).or(positionSchema);

export const coordinatesSchema = z.union([
    positionSchema,
    z.record(z.string(), z.number()).refine((value) => positionSchema.safeParse(Object.values(value)).success, { error: "Object must have exactly 2 properties" })
]);

export const $geometryBoundsSchema = z.union([
    polygonSchema,
    multiPolygonSchema
]).and(z.object({
    crs: z.object({
        type: z.literal("name"),
        properties: z.object({
            name: z.string()
        })
    }).optional()
}));

export const $geometryNearSchema = z.object({
    $geometry: pointSchema,
    $minDistance: z.number().optional(),
    $maxDistance: z.number().optional()
})