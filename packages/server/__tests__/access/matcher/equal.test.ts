import { deepEqual } from "#src/access/matcher.js";
import { describe, expect, test } from "vitest";

const deepEqualTests = [
    // Primitives
    { message: "same number", result: true,  a: 1, b: 1 },
    { message: "different numbers", result: false, a: 1, b: 2 },
    { message: "same string", result: true,  a: "hello", b: "hello" },
    { message: "different strings", result: false, a: "hello", b: "world" },
    { message: "same boolean", result: true,  a: true, b: true },
    { message: "different booleans", result: false, a: true, b: false },
    { message: "null vs null", result: true,  a: null, b: null },
    { message: "null vs undefined", result: false, a: null, b: undefined },
    { message: "undefined vs undefined", result: true, a: undefined, b: undefined },

    // Edge primitives
    { message: "NaN vs NaN (should be false with ===)", result: false, a: NaN, b: NaN },
    { message: "Infinity vs Infinity", result: true,  a: Infinity, b: Infinity },
    { message: "Infinity vs -Infinity", result: false, a: Infinity, b: -Infinity },
    { message: "0 vs -0 (strict equal treats as true)", result: true, a: 0, b: -0 },
    { message: "wrapped number vs primitive", result: false, a: new Number(1), b: 1 },
    { message: "wrapped string vs primitive", result: false, a: new String("a"), b: "a" },
    { message: "wrapped boolean vs primitive", result: false, a: new Boolean(true), b: true },

    // Dates
    { message: "same date", result: true,  a: new Date("2023-01-01"), b: new Date("2023-01-01") },
    { message: "different dates", result: false, a: new Date("2023-01-01"), b: new Date("2024-01-01") },

    // Arrays
    { message: "same array", result: true,  a: [1, 2, 3], b: [1, 2, 3] },
    { message: "same values, different order", result: false, a: [1, 2, 3], b: [1, 3, 2] },
    { message: "different lengths", result: false, a: [1, 2], b: [1, 2, 3] },
    { message: "empty arrays", result: true,  a: [], b: [] },

    // Objects
    { message: "same object", result: true,  a: { x: 1, y: 2 }, b: { x: 1, y: 2 } },
    { message: "object with different values", result: false, a: { x: 1, y: 2 }, b: { x: 1, y: 3 } },
    { message: "object with missing property", result: false, a: { x: 1, y: 2 }, b: { x: 1 } },
    { message: "empty objects", result: true,  a: {}, b: {} },

    // Nested
    { message: "same nested structure", result: true,  a: { foo: [1, { bar: "baz" }] }, b: { foo: [1, { bar: "baz" }] } },
    { message: "different nested property", result: false, a: { foo: [1, { bar: "baz" }] }, b: { foo: [1, { bar: "qux" }] } },
    { message: "deep nested objects same", result: true,  a: { a: { b: { c: { d: 1 } } } }, b: { a: { b: { c: { d: 1 } } } } },
    { message: "deep nested objects different", result: false, a: { a: { b: { c: { d: 1 } } } }, b: { a: { b: { c: { d: 2 } } } } },
    { message: "object with array values same", result: true,  a: { list: [1, 2, 3] }, b: { list: [1, 2, 3] } },
    { message: "object with array values different", result: false, a: { list: [1, 2, 3] }, b: { list: [1, 3, 2] } },
    { message: "complex nested object same", result: true,  
        a: { users: [{ id: 1, info: { name: "Alice" } }, { id: 2, info: { name: "Bob" } }] },  
        b: { users: [{ id: 1, info: { name: "Alice" } }, { id: 2, info: { name: "Bob" } }] } 
    },
    { message: "complex nested object different", result: false,  
        a: { users: [{ id: 1, info: { name: "Alice" } }, { id: 2, info: { name: "Bob" } }] },  
        b: { users: [{ id: 1, info: { name: "Alice" } }, { id: 2, info: { name: "Charlie" } }] } 
    },

    // number ↔ string / boolean / bigint
    { message: "number ↔ string", result: false, a: 1, b: "1" },
    { message: "number ↔ boolean", result: false, a: 0, b: false },
    { message: "number ↔ boolean", result: false, a: 1, b: true },
    { message: "number ↔ bigint", result: false, a: 1, b: 1n },

    // string ↔ boolean / symbol / number
    { message: "string ↔ boolean", result: false, a: "true", b: true },
    { message: "string ↔ number",  result: false, a: "1", b: 1 },
    { message: "string ↔ symbol", result: false, a: "sym", b: Symbol("sym") },

    // null/undefined ↔ object/array/date
    { message: "null ↔ object", result: false, a: null, b: {} },
    { message: "undefined ↔ object", result: false, a: undefined, b: {} },
    { message: "null ↔ array", result: false, a: null, b: [] },
    { message: "undefined ↔ array", result: false, a: undefined, b: [] },
    { message: "null ↔ date", result: false, a: null, b: new Date(0) },
    { message: "undefined ↔ date", result: false, a: undefined, b: new Date(0) },

    // array ↔ object / set / typed array
    { message: "array ↔ object", result: false, a: [1, 2], b: { 0: 1, 1: 2, length: 2 } },
    { message: "array ↔ object (empty)", result: false, a: [], b: {} },
    { message: "array ↔ set", result: false, a: [1, 2, 3], b: new Set([1, 2, 3]) },
    { message: "array ↔ typed array", result: false, a: [1, 2], b: new Uint8Array([1, 2]) },

    // date ↔ string / number / object
    { message: "date ↔ string", result: false, a: new Date("2023-01-01"), b: "2023-01-01" },
    { message: "date ↔ number", result: false, a: new Date(1700000000000), b: 1700000000000 },
    { message: "date ↔ object", result: false, a: new Date("2023-01-01"), b: { getTime: () => new Date("2023-01-01").getTime() } },

    // object ↔ map / function
    { message: "object ↔ map", result: false, a: { a: 1 }, b: new Map([["a", 1]]) },
    { message: "object ↔ function", result: false, a: { a: 1 }, b: function () {} },

    // boolean object ↔ plain object / array
    { message: "boolean object ↔ plain object", result: false, a: new Boolean(true), b: { value: true } },
    { message: "boolean object ↔ array", result: false, a: new Boolean(false), b: [] },
]

describe('Access - Matcher - deepEqual', () => {
    test.each(deepEqualTests)('$message', async ({ a, b, result }) => {        
        expect(deepEqual(a, b)).toBe(result);
    });
});