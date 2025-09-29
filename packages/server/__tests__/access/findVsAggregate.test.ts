import { describe, expect, test, beforeAll } from "vitest";
import { Mongalayer, MongalayerCollection, MongalayerCollections } from "#src/core";
import { User } from "#test/data/user";
import { Project, projectSchema } from "#test/data/project";
import { JwtPayload } from "jsonwebtoken";
import { dbName, getMongaLayerForCollections, projectObjects, userObjects } from "#test/lib/database";
import { MongalayerCollectionType } from "#src/index.js";

describe('Access project asset - user owner (via project)', () => {
    let mongalayer: Mongalayer, userZeroAccessPayload: JwtPayload;

    const userZero = userObjects[0];

    beforeAll(async () => {
        const projectCollection: MongalayerCollection<Project> = {
            schema: projectSchema,
            access: [{
                role: "owner",
                filter: {
                    "access.owners": {"$in":["%%user.sub"]}
                }
            }, {
                role: "contributor",
                filter: {
                    "access.contributors": {"$in":["%%user.sub"]}
                }
            }, {
                role: "reader",
                filter: {
                    "access.readers": {"$in":["%%user.sub"]}
                }
            }]
        };

        const collections: MongalayerCollections = {
            projects: projectCollection
        }
    
        userZeroAccessPayload = {
            user: {
                sub: userZero._id
            }
        };

        mongalayer = await getMongaLayerForCollections(collections, { debugging: true });
    });

    test("find", async () => {
        const resultFind = await mongalayer.executeRaw({
            database: dbName,
            collection: "projects" as MongalayerCollectionType<Project>,
            operation: "find"
        }, {
            filter: {
                type: "premium"
            }, 
            options: {
                sort: { createdAt: -1 },
                limit: 10,
                skip: 2
            }
        }, userZeroAccessPayload);

        const resultAggregate = await mongalayer.executeRaw({
            database: dbName,
            collection: "projects" as MongalayerCollectionType<Project>,
            operation: "aggregate"
        }, {
            pipeline: [ 
                { $match: { type: "premium" } },
                { $sort: { createdAt: -1 } },
                { $skip: 2 },
                { $limit: 10 }
            ]
        }, userZeroAccessPayload);

        expect(resultFind.length).toBe(resultAggregate.length);
        expect(resultFind).toEqual(resultAggregate);        
    });
});