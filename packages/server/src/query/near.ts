import { $geometryNearSchema, positionSchema } from "../schema/geo.js";
import { isArray, isObject } from "@mongalayer/core";
import type { Document, Filter } from "mongodb";
import z from "zod";

type NearLegacy = z.infer<typeof positionSchema>;
type NearGeometry = z.infer<typeof $geometryNearSchema>;
type Near = NearLegacy | NearGeometry;

type GeoNear = {
    key: string,
    distanceField: string,
    spherical: boolean,
    near: NearLegacy | NearGeometry["$geometry"],
    query?: Filter<Document>,
    minDistance?: number,
    maxDistance?: number
}

function getNearPath (filter: Filter<Document>, path: string[] = []): string[] | null {
    const entries: [string | number, any][] = [];
    
    if (isArray(filter)) {
        entries.push(...filter.entries());
    } else if (isObject(filter)) {
        entries.push(...Object.entries(filter));
    }

    if (entries.length > 0) {
        for (const [key, value] of entries) {
            if (key === "$near" || key === "$nearSphere") {
                return path;
            } else if (isArray(value) || isObject(value)) {
                const result = getNearPath(value, [...path, key.toString()]);

                if (result !== null) return result;
            }
        }
    }

    return null;
}
            

export function hasNearQuery (filter: Filter<Document>): string[] | false {
    return getNearPath(filter) ?? false;
}

export function transformNearToGeoNear (filter: Filter<Document>, nearParentPath: string[]): GeoNear {
    const newFilter = structuredClone(filter);
    const nearParent = nearParentPath.reduce((acc, key) => acc[key], newFilter);
    const nearPathMap = nearParentPath.map((key, index) => ({ key, parentRef: nearParentPath.slice(0, index).reduce((acc, key) => acc[key], newFilter) }));
    const nearKey = Object.keys(nearParent).find(key => key === "$near" || key === "$nearSphere")!;

    const near: Near = nearParent[nearKey];
    delete nearParent[nearKey];

    const $geoNear: Partial<GeoNear> = {
        key: nearParentPath.join("."),
        distanceField: "__mongalayer_geonear_distance",
        spherical: nearKey === "$nearSphere"
    };

    // Legacy coordinates
    if (Array.isArray(near)) {
        $geoNear.near = near;

        if (nearParent.$minDistance !== void 0) {
            $geoNear.minDistance = nearParent.$minDistance
            delete nearParent.$minDistance;
        };

        if (nearParent.$maxDistance !== void 0) { 
            $geoNear.maxDistance = nearParent.$maxDistance; 
            delete nearParent.$maxDistance;
        }
    } else {
        $geoNear.near = near.$geometry;
        if (near.$minDistance !== void 0) $geoNear.minDistance = near.$minDistance;
        if (near.$maxDistance !== void 0) $geoNear.maxDistance = near.$maxDistance;
    }

    // Clean out the query object
    for (let i=nearPathMap.length; i--;) {
        const { key, parentRef } = nearPathMap[i];

        if (isObject(parentRef[key]) && Object.keys(parentRef[key]).length === 0) {
            delete parentRef[key];
        } else if (isArray(parentRef[key]) && parentRef[key].length === 0) {
            delete parentRef[key];
        } else {
            break; // Stop deleting when we hit a non-empty object or array
        }
    }

    if (Object.keys(newFilter).length > 0) {
        $geoNear.query = newFilter;
    }

    return $geoNear as GeoNear;
}