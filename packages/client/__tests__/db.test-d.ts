import { describe, expectTypeOf, test } from 'vitest';
import { AggregateReturnType, Document, FindOneReturnType, FindReturnType, MongalayerClient } from '../src';
import { BatchOperation } from '../src/batch';
import { CollectionName } from '../src/collection';

const client = new MongalayerClient("http://localhost");

const db = client.db("test");

type User = {
    _id: string,
    name: string,
    age: number,
}

type Project = {
    _id: string,
    label: string,
    location: [number, number]
}

type GetCollectionSchema<T extends string> = 
    T extends "users" ? CollectionName<User> : 
    never;

function getCollectionName<T extends string>(name: T): GetCollectionSchema<T> {
    return name as any;
}

const usersCollectionName: CollectionName<User> = "users";

describe('Db', () => {
    describe('batch', () => {
        describe('Using constructor', () => {
            test('CollectionName through variable', async () => {
                const result = await db.batch([
                    // Preferred as the variable constant can be reused
                    new BatchOperation(usersCollectionName, "find", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through function', async () => {
                const result = await db.batch([
                    new BatchOperation(getCollectionName("users"), "find", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through inline', async () => {
                const result = await db.batch([
                    new BatchOperation("users" as CollectionName<User>, "find", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through class Generic', async () => {
                // Breaks type inference for the operation
                const result = await db.batch([
                    new BatchOperation<User>("users", "find", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> | FindOneReturnType<User> | AggregateReturnType<User> ]>();
            });

            test('Unknown collection type', async () => {
                const result = await db.batch([
                    new BatchOperation("users", "find", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<Document> ]>();
                expectTypeOf(result).toEqualTypeOf<[ Document[] | Partial<Document>[] ]>();
            });
        });

        describe('Using static methods', () => {
            test('CollectionName through variable', async () => {
                const result = await db.batch([
                    BatchOperation.find(usersCollectionName, {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through function', async () => {
                const result = await db.batch([
                    BatchOperation.find(getCollectionName("users"), {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through inline', async () => {
                const result = await db.batch([
                    BatchOperation.find("users" as CollectionName<User>, {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('CollectionName through function Generic', async () => {
                // Preferred as it keeps type inference for the operation
                const result = await db.batch([
                    BatchOperation.find<User>("users", {
                        filter: { age: { $gt: 18 } }
                    })
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });
        });

        describe('Using object literals', () => {
            test('CollectionName through inline', async () => {
                const result = await db.batch([
                    {
                        collection: "users" as CollectionName<User>,
                        operation: "find",
                        payload: {
                            filter: { age: { $gt: 18 } }
                        }
                    }
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<User> ]>();
                expectTypeOf(result).toEqualTypeOf<[ User[] | Partial<User>[] ]>();
            });

            test('Unknown collection type', async () => {
                const result = await db.batch([
                    {
                        collection: "users",
                        operation: "find",
                        payload: {
                            filter: { age: { $gt: 18 } }
                        }
                    }
                ]);

                expectTypeOf(result).toEqualTypeOf<[ FindReturnType<Document> ]>();
                expectTypeOf(result).toEqualTypeOf<[ Document[] | Partial<Document>[] ]>();
            });
        });
        
        describe('Multiple operations', () => {
            test('Over different collections', async () => {
                const result = await db.batch([
                    new BatchOperation(usersCollectionName, "find", {
                        filter: { age: { $gt: 18 } }
                    }),
                    BatchOperation.findOne("projects" as CollectionName<Project>, {
                        filter: { label: "Project A" }
                    }),
                    {
                        collection: "projects" as CollectionName<Project>,
                        operation: "aggregate",
                        payload: {
                            pipeline: [
                                { $match: { location: { $near: [40, -70] } } },
                                { $group: { _id: null, averageAge: { $avg: "$age" } } }
                            ]
                        }
                    }
                ]);

                expectTypeOf(result).toEqualTypeOf<[ 
                    FindReturnType<User>, 
                    FindOneReturnType<Project>, 
                    AggregateReturnType<Project> 
                ]>();

                expectTypeOf(result[0]).toEqualTypeOf<FindReturnType<User>>();
                expectTypeOf(result[1]).toEqualTypeOf<FindOneReturnType<Project>>();
                expectTypeOf(result[2]).toEqualTypeOf<AggregateReturnType<Project>>();
            });
        });
    });
});