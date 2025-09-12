import { describe, expect, test, beforeEach } from "vitest";
import { MongalayerCollections } from "#src/core";
import { dbName, getMongaLayerForCollections, projectObjects, resetCUDCollections, userObjects } from "#test/lib/database";
import { AccessConfig, AccessDefaults } from "#src/access.js";
import { Project, projectSchema } from "#test/data/project.js";
import { MongalayerCollectionType } from "#src/index.js";
import { Document } from "mongodb";
import { PartialDeep } from "type-fest";
import { User } from "#test/data/user.js";
import { Filter, Operation } from "#src/client.js";

const projectZero: Project = projectObjects[0], userZero: User = userObjects[0];

type DeleteOperation = Extract<Operation, "deleteOne" | "deleteMany">;

const testSimpleDelete = async (operation: DeleteOperation, deletedCount: number, filter: Filter, access: AccessConfig<Document>, accessDefaults: PartialDeep<AccessDefaults>) => {
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
        operation
    }, {
        filter
    }, {user: {id: userZero._id}});

    expect(result.acknowledged).toBeTruthy();
    expect(result.deletedCount).toBe(deletedCount);
}

const testSimpleDeleteOne = async (deletedCount: 0 | 1, access: AccessConfig<Document>, accessDefaults: PartialDeep<AccessDefaults>) => {
    return testSimpleDelete("deleteOne", deletedCount, { _id: projectZero._id }, access, accessDefaults);
};

type DeleteTest = {
    operation: DeleteOperation,
    filter: Filter,
    deletedCount: number
}

const deleteTests: DeleteTest[] = [{
    operation: "deleteOne",
    filter: { _id: projectZero._id },
    deletedCount: 1
}, {
    operation: "deleteMany",
    filter: { },
    deletedCount: projectObjects.length
}]

describe('Access - Delete', () => {
    for (const deleteTest of deleteTests) {
        describe(deleteTest.operation, () => {
            beforeEach(async () => {
                await resetCUDCollections();
            })

            test("No roles, default = undefined", async () => {
                await expect(testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [], {})).rejects.toThrowError("Delete permission error: No roles exist for the collection and default delete permission is set to false.");
            });

            test("No roles, default = false", async () => {
                await expect(testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [], { delete: false })).rejects.toThrowError("Delete permission error: No roles exist for the collection and default delete permission is set to false.");
            });

            test("No roles, default = true", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [], { delete: true })
            });

            test("1 Role delete = undefined, default = undefined", async () => {
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
                    role: "test"
                }], {  })
            });
            
            test("1 Role delete = undefined, default = false", async () => {
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
                    role: "test"
                }], { delete: false })
            });
            
            test("1 Role delete = undefined, default = true", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [{
                    role: "test"
                }], { delete: true })
            });

            test("1 Role delete = false, default = undefined", async () => {
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
                    role: "test",
                    delete: false
                }], {  })
            });
            
            test("1 Role delete = false, default = false", async () => {
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
                    role: "test",
                    delete: false
                }], { delete: false })
            });
            
            test("1 Role delete = false, default = true", async () => {
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
                    role: "test",
                    delete: false
                }], { delete: true })
            });

            test("1 Role delete = true, default = undefined", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [{
                    role: "test",
                    delete: true
                }], {  })
            });
            
            test("1 Role delete = true, default = false", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [{
                    role: "test",
                    delete: true
                }], { delete: false })
            });
            
            test("1 Role delete = true, default = true", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [{
                    role: "test",
                    delete: true
                }], { delete: true })
            });
            
            test("User matches role with delete = true", async () => {
                await testSimpleDelete(deleteTest.operation, deleteTest.deletedCount, deleteTest.filter, [{
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
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
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
                await testSimpleDelete(deleteTest.operation, 0, deleteTest.filter, [{
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
    }
});

describe('Access - Delete many', () => {
    describe('Owner (delete = true), contributor (delete = false), reader (delete = undefined)', () => {
        const accessConfig: AccessConfig<Document> = [{
            role: "owner",
            filter: {
                "access.owners": {"$in": ["%%user.id"]}
            },
            delete: true
        }, {
            role: "contributor",
            filter: {
                "access.contributors": {"$in": ["%%user.id"]}
            },
            delete: false
        }, {
            role: "reader",
            filter: {
                "access.readers": {"$in": ["%%user.id"]}
            }
        }];

        beforeEach(async () => {
            await resetCUDCollections();
        });

        test("Delete all documents", async () => {
            const projectsCountByOwner = projectObjects.reduce((acc, project) => project.access.owners.includes(userZero._id) ? acc + 1 : acc, 0);

            await testSimpleDelete("deleteMany", projectsCountByOwner, {  }, accessConfig, {});
        });

        test("Delete some documents as owner", async () => {
            const projectsAsOwner = projectObjects.reduce((acc, project) => {
                if (project.access.owners.includes(userZero._id)) acc.push(project._id);
                return acc;
            }, [] as string[]).slice(0, 2);

            await testSimpleDelete("deleteMany", projectsAsOwner.length, { _id: { $in: projectsAsOwner } }, accessConfig, {});
        });

        test("Delete documents as contributor", async () => {
            const projectsAsContributor = projectObjects.reduce((acc, project) => {
                if (project.access.contributors.includes(userZero._id)) acc.push(project._id);
                return acc;
            }, [] as string[]);

            await testSimpleDelete("deleteMany", 0, { _id: { $in: projectsAsContributor } }, accessConfig, {});
        });

        test("Delete documents as reader", async () => {
            const projectsAsReader = projectObjects.reduce((acc, project) => {
                if (project.access.readers.includes(userZero._id)) acc.push(project._id);
                return acc;
            }, [] as string[]);

            await testSimpleDelete("deleteMany", 0, { _id: { $in: projectsAsReader } }, accessConfig, {});
        });
    });
});