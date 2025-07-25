import { hasNearQuery, transformNearToGeoNear } from "#src/query/near.js";
import { Document, Filter } from "mongodb";
import { describe, expect, test } from "vitest";

describe('Query - Near', () => {
    describe("hasNearQuery", () => {
        test("No $near or $nearSphere", () => {
            const filter: Filter<Document> = { metadata: { location: "x" }, prop: null };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toBe(false);
        });

        test("$near with GeoObject", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: { $geometry: { type: "Point", coordinates: [10, 20] }, $maxDistance: 1000 } } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);
        });

        test("$near with legacy coordinates", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: [10, 20] } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);
        });

        test("$nearSphere with GeoObject", () => {
            const filter: Filter<Document> = { metadata: { location: { $nearSphere: { $geometry: { type: "Point", coordinates: [10, 20] }, $maxDistance: 1000 } } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);
        });

        test("$nearSphere with legacy coordinates", () => {
            const filter: Filter<Document> = { metadata: { location: { $nearSphere: [10, 20] } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);
        });
    });

    describe("transformNearToGeoNear", () => {
        test("$near with GeoObject", () => {
            const filter: Filter<Document> = {
                metadata: {
                    location: {
                        $near: {
                            $geometry: { type: "Point", coordinates: [10, 20] },
                            $minDistance: 100,
                            $maxDistance: 1000
                        }
                    }
                },
                prop: null
            };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: false,
                    query: { prop: null },
                    near: { type: "Point", coordinates: [10, 20] },
                    minDistance: 100,
                    maxDistance: 1000,
                    distanceField: "__mongalayer_geonear_distance"
                });
            }
        });

        test("$near with legacy coordinates", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: [10, 20] } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: false,
                    near: [10, 20],
                    distanceField: "__mongalayer_geonear_distance",
                });
            }
        });

        test("$nearSphere = spherical", () => {
            const filter: Filter<Document> = { metadata: { location: { $nearSphere: [10, 20] } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: true,
                    near: [10, 20],
                    distanceField: "__mongalayer_geonear_distance",
                });
            }
        });
    });

    describe("$geoNear.query", () => {
        test("with no extra props", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: [10, 20] } } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: false,
                    // query -> should be missing
                    near: [10, 20],
                    distanceField: "__mongalayer_geonear_distance"
                });
            }
        });

        test("with nested prop", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: [10, 20] }, nestedprop: null } };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: false,
                    query: { metadata: { nestedprop: null } },
                    near: [10, 20],
                    distanceField: "__mongalayer_geonear_distance",
                });
            }
        });

        test("with root prop & nested prop", () => {
            const filter: Filter<Document> = { metadata: { location: { $near: [10, 20] }, nestedprop: null }, prop: null };

            const nearResult = hasNearQuery(filter);
            expect(nearResult).toStrictEqual(["metadata", "location"]);

            if (nearResult !== false) {
                const newFilter = transformNearToGeoNear(filter, nearResult);

                expect(newFilter).toStrictEqual({
                    key: "metadata.location",
                    spherical: false,
                    query: { metadata: { nestedprop: null }, prop: null },
                    near: [10, 20],
                    distanceField: "__mongalayer_geonear_distance"
                });
            }
        });
    });
});