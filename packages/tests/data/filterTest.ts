import z, { ZodType } from "zod/v4";

type BSONValue = string | number | boolean | null | Date | { [key: string]: BSONValue } | BSONValue[];

export interface FilterTest extends Record<string, BSONValue> {
    _id: string;
}

export const filterTestsSchema = z.object({
    _id: z.string()
}).and(z.record(z.string(), z.any())) satisfies ZodType<FilterTest>;

export function getFilterTests(): FilterTest[] {
    return [
        exampleObject1, 
        exampleObject2
    ];
}

// Example 1: Complex nested object
export const exampleObject1: FilterTest = {
    _id: "a",
    name: "Complex Object 1",
    details: {
        description: "This is a complex object for testing.",
        metadata: {
            createdAt: new Date("2023-01-01T00:00:00Z"),
            updatedAt: "2023-06-01T00:00:00Z",
            tags: ["example", "test", "complex"],
            nestedArray: [
                { key: "value1", value: 100 },
                { key: "value2", value: 200 },
                { key: "value3", value: 300 }
            ]
        },
        nestedObject: {
            property1: "propertyString1",
            property2: 123,
            property3: true,
            property4: null,
            property5: ["nestedString", 456, false]
        }
    },
    data: [
        { id: 1, value: "value1", nested: { key: "value1", value: 100 } },
        { id: 2, value: "value2", nested: { key: "value2", value: 200 } },
        { id: 3, value: "value3", nested: { key: "value3", value: 300 } }
    ],
    status: true,
    extra: null
};

// Example 2: Another complex nested object
export const exampleObject2: FilterTest = {
    _id: "b",
    name: "Complex Object 2",
    details: {
        description: "This is another complex object for testing.",
        metadata: {
            createdAt: new Date("2023-02-01T00:00:00Z"),
            updatedAt: "2023-07-01T00:00:00Z",
            tags: ["example", "test", "complex"],
            nestedArray: [
                { key: "value4", value: 400 },
                { key: "value5", value: 500 },
                { key: "value6", value: 600 }
            ]
        },
        nestedObject: {
            property1: "propertyString2",
            property2: 789,
            property3: false,
            property4: null,
            property5: ["nestedString", 101, true]
        }
    },
    data: [
        { id: 1, value: "value4", nested: { key: "value4", value: 400 } },
        { id: 2, value: "value5", nested: { key: "value5", value: 500 } },
        { id: 3, value: "value6", nested: { key: "value6", value: 600 } }
    ],
    status: false,
    extra: null
};
