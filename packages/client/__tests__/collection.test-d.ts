import { describe, expectTypeOf, test } from 'vitest';
import {
    AggregateReturnType,
    DeleteManyReturnType,
    DeleteOneReturnType,
    Document,
    FindOneAndUpdateReturnType,
    FindOneReturnType,
    FindReturnType,
    InsertManyReturnType,
    InsertOneReturnType,
    MongalayerClient,
    UpdateManyReturnType,
    UpdateOneReturnType
} from '../src';
import { CollectionName } from '../src/collection';

const client = new MongalayerClient("http://localhost");

const db = client.db("test");

type Project = {
    _id: string,
    label: string,
    numbers: number[],
    version: number,
    dates: {
        createdAt: Date,
    },
    list: { 
        name: string,
        value: number
    }[]
}

const projectCollectionName: CollectionName<Project> = "projects";

const projects = db.collection(projectCollectionName);

describe('Collection', () => {
    describe('findOne', () => {
        test('Basic', async () => {
            const result = await projects.findOne({ label: "Project A" });

            expectTypeOf(result).toEqualTypeOf<FindOneReturnType<Project>>();
            expectTypeOf(result).toEqualTypeOf<Project | Partial<Project> | null>();
        });

        test('With options', async () => {
            const result = await projects.findOne(
                { label: "Project A", "list.name": 1 },
                { projection: { label: 1, "list.value": 1 }, sort: { label: 1, "list.value": 1 } }
            );

            expectTypeOf(result).toEqualTypeOf<FindOneReturnType<Project>>();
        });

        test('With context', async () => {
            const result = await projects.findOne({ label: "Project A" }, undefined, { reference: "dashboard" });

            expectTypeOf(result).toEqualTypeOf<FindOneReturnType<Project>>();
        });
    });

    describe('find', () => {
        test('Basic', async () => {
            const result = await projects.find({ label: "Project A" });

            expectTypeOf(result).toEqualTypeOf<FindReturnType<Project>>();
            expectTypeOf(result).toEqualTypeOf<Project[] | Partial<Project>[]>();
        });

        test('With options', async () => {
            const result = await projects.find(
                { label: "Project A" },
                { projection: { label: 1 }, limit: 10, skip: 5, sort: { label: -1 } }
            );

            expectTypeOf(result).toEqualTypeOf<FindReturnType<Project>>();
        });

        test('With context', async () => {
            const result = await projects.find({ label: "Project A" }, undefined, { reference: "dashboard" });

            expectTypeOf(result).toEqualTypeOf<FindReturnType<Project>>();
        });
    });

    describe('findOneAndUpdate', () => {
        test('Basic', async () => {
            const result = await projects.findOneAndUpdate(
                { label: "Project A" },
                { $set: { label: "Project B" } }
            );

            expectTypeOf(result).toEqualTypeOf<FindOneAndUpdateReturnType<Project>>();
            expectTypeOf(result).toEqualTypeOf<null | Project | Partial<Project>>();
        });

        test('With options', async () => {
            const result = await projects.findOneAndUpdate(
                { label: "Project A" },
                { $set: { label: "Project B" } },
                { projection: { label: 1 }, upsert: true, sort: { label: 1 }, returnDocument: "after" }
            );

            expectTypeOf(result).toEqualTypeOf<FindOneAndUpdateReturnType<Project>>();
        });

        test('With context', async () => {
            const result = await projects.findOneAndUpdate(
                { label: "Project A" },
                { $set: { label: "Project B" } },
                undefined,
                { reference: "dashboard" }
            );

            expectTypeOf(result).toEqualTypeOf<FindOneAndUpdateReturnType<Project>>();
        });
    });

    describe('aggregate', () => {
        test('Basic', async () => {
            const result = await projects.aggregate([
                { $match: { label: "Project A" } },
                { $group: { _id: null, averageNumbers: { $avg: "$numbers" } } }
            ]);

            expectTypeOf(result).toEqualTypeOf<AggregateReturnType<Project>>();
            expectTypeOf(result).toEqualTypeOf<
                (Project & Document)[] | (Partial<Project> & Document)[] | Document[]
            >();
        });

        test('With context', async () => {
            const result = await projects.aggregate(
                [{ $match: { label: "Project A" } }],
                undefined,
                { reference: "dashboard" }
            );

            expectTypeOf(result).toEqualTypeOf<AggregateReturnType<Project>>();
        });
    });

    describe('insertOne', () => {
        test('Basic', async () => {
            const result = await projects.insertOne({
                _id: "1",
                label: "Project A",
                numbers: [40, -70],
                version: 1,
                dates: {
                    createdAt: new Date()
                },
                list: [
                    { name: "Item 1", value: 10 },
                    { name: "Item 2", value: 20 }
                ]
            });

            expectTypeOf(result).toEqualTypeOf<InsertOneReturnType<Project>>();
        });

        test('With context', async () => {
            const result = await projects.insertOne(
                { _id: "1", label: "Project A", numbers: [40, -70], version: 1, dates: { createdAt: new Date() }, list: [ { name: "Item 1", value: 10 }, { name: "Item 2", value: 20 } ] },
                {},
                { reference: "dashboard" }
            );

            expectTypeOf(result).toEqualTypeOf<InsertOneReturnType<Project>>();
        });
    });

    describe('insertMany', () => {
        test('Basic', async () => {
            const result = await projects.insertMany([
                { _id: "1", label: "Project A", numbers: [40, -70], version: 1, dates: { createdAt: new Date() }, list: [ { name: "Item 1", value: 10 }, { name: "Item 2", value: 20 } ] },
                { _id: "2", label: "Project B", numbers: [41, -71], version: 2, dates: { createdAt: new Date() }, list: [ { name: "Item 1", value: 10 }, { name: "Item 2", value: 20 } ] }
            ]);

            expectTypeOf(result).toEqualTypeOf<InsertManyReturnType<Project>>();
        });

        test('With options', async () => {
            const result = await projects.insertMany(
                [{ _id: "1", label: "Project A", numbers: [40, -70], version: 1, dates: { createdAt: new Date() }, list: [ { name: "Item 1", value: 10 }, { name: "Item 2", value: 20 } ] }],
                { ordered: true }
            );

            expectTypeOf(result).toEqualTypeOf<InsertManyReturnType<Project>>();
        });
    });

    describe('updateOne', () => {
        test('Basic', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $set: { label: "Project B" } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('Basic - nested', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $set: { "dates.createdAt": new Date() } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('With options', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $set: { label: "Project B" } },
                { upsert: true, sort: { label: 1 } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('$unset', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $unset: { numbers: "" } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('$inc', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $inc: { version: 1 } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('$push', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $push: { numbers: 42 } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });

        test('$pull', async () => {
            const result = await projects.updateOne(
                { label: "Project A" },
                { $pull: { numbers: 42 } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateOneReturnType<Project>>();
        });
    });

    describe('updateMany', () => {
        test('Basic', async () => {
            const result = await projects.updateMany(
                { label: "Project A" },
                { $set: { label: "Project B" } }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateManyReturnType<Project>>();
        });

        test('With context', async () => {
            const result = await projects.updateMany(
                { label: "Project A" },
                { $set: { label: "Project B" } },
                {},
                { reference: "dashboard" }
            );

            expectTypeOf(result).toEqualTypeOf<UpdateManyReturnType<Project>>();
        });
    });

    describe('deleteOne', () => {
        test('Basic', async () => {
            const result = await projects.deleteOne({ label: "Project A" });

            expectTypeOf(result).toEqualTypeOf<DeleteOneReturnType>();
        });

        test('With context', async () => {
            const result = await projects.deleteOne({ label: "Project A" }, {}, { reference: "dashboard" });

            expectTypeOf(result).toEqualTypeOf<DeleteOneReturnType>();
        });
    });

    describe('deleteMany', () => {
        test('Basic', async () => {
            const result = await projects.deleteMany({ label: "Project A" });

            expectTypeOf(result).toEqualTypeOf<DeleteManyReturnType>();
        });

        test('With context', async () => {
            const result = await projects.deleteMany({ label: "Project A" }, {}, { reference: "dashboard" });

            expectTypeOf(result).toEqualTypeOf<DeleteManyReturnType>();
        });
    });
});