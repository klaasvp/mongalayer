import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults } from "#src/access.js";
import { Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { User } from "#test/data/user.js";

const projectZero: Project = projectObjects[0], userZero: User = userObjects[0];

const testSimpleDelete = async (deletedCount: 0 | 1, access: AccessConfig<Document>, accessDefaults: PartialDeep<AccessDefaults>) => {
    const collections: MongalayerCollections = {
        projectsCUD: {
            schema: projectSchema,
            access
        }
    };

    const mongalayer = await getMongaLayerForCollections(collections, { debugging: true, accessDefaults });

    const result = await mongalayer.executeRaw({
        database: dbName,
        collection: "projectsCUD" as MongalayerCollectionType<Project>,
        operation: "deleteOne"
    }, {
        filter: {
            _id: projectZero._id
        }
    }, {user: {id: userZero._id}});

    expect(result.acknowledged).toBeTruthy();
    expect(result.deletedCount).toBe(deletedCount);
}

describe('Access - Delete', () => {
    beforeEach(async () => {
        await resetCUDCollections();
    })

    test("No roles, default = undefined", async () => {
        await expect(testSimpleDelete(0, [], {})).rejects.toThrowError("Delete permission error: No roles exist for the collection and default delete permission is set to false.");
    });

    test("No roles, default = false", async () => {
        await expect(testSimpleDelete(0, [], { delete: false })).rejects.toThrowError("Delete permission error: No roles exist for the collection and default delete permission is set to false.");
    });

    test("No roles, default = true", async () => {
        await testSimpleDelete(1, [], { delete: true })
    });

    test("1 Role delete = undefined, default = undefined", async () => {
        await testSimpleDelete(0, [{
            role: "test"
        }], {  })
    });
    
    test("1 Role delete = undefined, default = false", async () => {
        await testSimpleDelete(0, [{
            role: "test"
        }], { delete: false })
    });
    
    test("1 Role delete = undefined, default = true", async () => {
        await testSimpleDelete(1, [{
            role: "test"
        }], { delete: true })
    });

    test("1 Role delete = false, default = undefined", async () => {
        await testSimpleDelete(0, [{
            role: "test",
            delete: false
        }], {  })
    });
    
    test("1 Role delete = false, default = false", async () => {
        await testSimpleDelete(0, [{
            role: "test",
            delete: false
        }], { delete: false })
    });
    
    test("1 Role delete = false, default = true", async () => {
        await testSimpleDelete(0, [{
            role: "test",
            delete: false
        }], { delete: true })
    });

    test("1 Role delete = true, default = undefined", async () => {
        await testSimpleDelete(1, [{
            role: "test",
            delete: true
        }], {  })
    });
    
    test("1 Role delete = true, default = false", async () => {
        await testSimpleDelete(1, [{
            role: "test",
            delete: true
        }], { delete: false })
    });
    
    test("1 Role delete = true, default = true", async () => {
        await testSimpleDelete(1, [{
            role: "test",
            delete: true
        }], { delete: true })
    });
    
    test("User matches role with delete = true", async () => {
        await testSimpleDelete(1, [{
            role: "self",
            filter: {
                $expr: { $in: [ "%%user.id", [ userZero._id ]] }
            },
            delete: true
        }, {
            role: "test"
        }], {})
    });
    
    test("User doesn't match role with delete = true", async () => {
        await testSimpleDelete(0, [{
            role: "self",
            filter: {
                $expr: { $in: [ "%%user.id", [ "x" ]] }
            },
            delete: true
        }, {
            role: "test"
        }], {})
    });
    
    test("User doesn't match role with delete = true (reversed role order)", async () => {
        await testSimpleDelete(0, [{
            role: "test"
        }, {
            role: "self",
            filter: {
                $expr: { $in: [ "%%user.id", [ userZero._id ]] }
            },
            delete: true
        }], {})
    });
});