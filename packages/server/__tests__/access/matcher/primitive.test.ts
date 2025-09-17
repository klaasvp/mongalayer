import { isPrimitive } from "#src/access/matcher.js";
import { describe, expect, test } from "vitest";

const isPrimitiveTests = [
    { value: "", result: true, message: "string = true" },
    { value: 0, result: true, message: "number = true" },
    { value: true, result: true, message: "boolean = true" },
    { value: null, result: true, message: "null = true" },
    { value: void 0, result: true, message: "undefined = true" },
    { value: {}, result: false, message: "object = false" },
    { value: [], result: false, message: "array = false" },
    { value: new Date(), result: false, message: "date = false" },
    { value: Symbol(), result: false, message: "symbol = false" },
    { value: BigInt(1), result: false, message: "bigint = false" },
    { value: () => {}, result: false, message: "arrow function = false" },
    { value: function () {}, result: false, message: "function = false" },
    { value: new Map(), result: false, message: "map = false" },
    { value: new Set(), result: false, message: "set = false" },
];

describe('Access - Matcher - isPrimitive', () => {
    test.each(isPrimitiveTests)('$message', async ({ value, result }) => {        
        expect(isPrimitive(Object.prototype.toString.call(value))).toBe(result);
    });
});