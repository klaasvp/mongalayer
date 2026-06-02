import { describe, expect, test, beforeAll } from "vitest";
import { Project, projectSchema } from "#test/data/project";
import { dbName, getMongaLayerForCollections, getMongoDBDatabase, projectAssetObjects, projectObjects } from "#test/lib/database";
import { Db, Document } from "mongodb";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { MongalayerCollectionType } from "#src/index.js";
import { ProjectAsset, projectAssetSchema } from "#test/data/projectAsset.js";

describe('Aggregate - lookup', () => {
    let mongalayer: Mongalayer, projectZero: Project, database: Db;

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = { schema: projectSchema, access: [] };
        const projectAssetsCollection: MongalayerCollection<ProjectAsset> = { schema: projectAssetSchema, access: [] };

        const collections: MongalayerCollections = {
            projects: projectCollection,
            projectAssets: projectAssetsCollection
        }
    
        projectZero = projectObjects[0];

        database = await getMongoDBDatabase();
        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("Project with assets", async () => {
        const results = await mongalayer.executeRaw({
            database: dbName,
            collection: "projects" as MongalayerCollectionType<Project>,
            operation: "aggregate"
        }, {
            pipeline: [{
                $match: { _id: projectZero._id }
            },
            { 
                $lookup: {
                    from: "projectAssets",
                    localField: "_id",
                    foreignField: "projectID",
                    as: "assets"
                }
            }]
        }, {});

        const projectZeroAssets = projectAssetObjects.filter(asset => asset.projectID === projectZero._id);

        expect(results).toHaveLength(1);

        results.forEach(result => {
            expect(result).toHaveProperty("_id");
            expect(result).toHaveProperty("assets");

            expect(result.assets).toHaveLength(projectZeroAssets.length);
        })
    });
});