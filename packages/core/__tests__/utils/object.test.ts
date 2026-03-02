import { describe, expect, test,  } from "vitest";
import { getValueByPathWithExists, merge, pathValueToObject, unflatten } from "#src/utils/object.js";

const toHavePrototype = function (actual: any) {
    if (
        typeof actual !== "object"
    ) {
        throw new TypeError('These must be of type object!');
    }

    const proto = Object.getPrototypeOf(actual);
    const pass = proto !== null;
    
    return {
        ...(pass ? {
            message: () => `expected object not to have prototype`,
            pass: true,
        } : {
            message: () => `expected object to have prototype`,
            pass: false,
        }),
        actual
    }
};

expect.extend({
    toHavePrototype,
});

interface CustomMatchers<R = unknown> {
  toHavePrototype: () => R
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

describe("getValueByPathWithExists", () => {
    test("returns value for a simple object path", () => {
        const obj = { a: { b: 42 } };
        const result = getValueByPathWithExists(obj, "a.b");
        expect(result).toEqual({ exists: true, value: 42 });
    });

    test("returns exists:false for missing key", () => {
        const obj = { a: { b: 42 } };
        const result = getValueByPathWithExists(obj, "a.c");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("returns exists:false when starting from primitive", () => {
        const obj = 123 as unknown as Record<string, unknown>;
        const result = getValueByPathWithExists(obj, "a");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("traverses arrays by numeric index", () => {
        const obj = { users: [{ name: "Ada" }, { name: "Linus" }] };
        const result = getValueByPathWithExists(obj, "users.1.name");
        expect(result).toEqual({ exists: true, value: "Linus" });
    });

    test("fan-outs across arrays when key is not numeric", () => {
        const obj = { users: [{ name: "Ada" }, { name: "Linus" }] };
        const result = getValueByPathWithExists(obj, "users.name");
        expect(result).toEqual({ exists: true, value: ["Ada", "Linus"] });
    });

    test("fan-out filters out non-matching items (mixed array)", () => {
        const obj = {
        users: [{ name: "Ada" }, { age: 30 }, "not-an-object", null, { name: "Linus" }],
        };
        const result = getValueByPathWithExists(obj, "users.name");
        // Only items where "name" exists should be returned
        expect(result).toEqual({ exists: true, value: ["Ada", "Linus"] });
    });

    test("fan-out yields empty array if no items match, but exists stays true", () => {
        const obj = { users: [{ age: 1 }, { age: 2 }] };
        const result = getValueByPathWithExists(obj, "users.name");
        expect(result).toEqual({ exists: true, value: [] });
    });

    test("handles nested arrays with fan-out", () => {
        const obj = {
            groups: [
                { users: [{ name: "Ada" }, { name: "Linus" }] },
                { users: [{ age: 1 }, { name: "Grace" }] },
            ],
        };
        const result = getValueByPathWithExists(obj, "groups.users.name");
        // First level fan-out on groups → recurse into each, second fan-out on users
        expect(result).toEqual({ exists: true, value: [["Ada", "Linus"], ["Grace"]] });
    });

    test("continues traversal after numeric index then fan-out", () => {
        const obj = {
            orgs: [
                { teams: [{ lead: { name: "Ada" } }, { lead: { name: "Grace" } }] },
                { teams: [{ lead: { name: "Linus" } }] },
            ],
        };
        // Pick org 0, then fan out teams.lead.name
        const result = getValueByPathWithExists(obj, "orgs.0.teams.lead.name");
        expect(result).toEqual({ exists: true, value: ["Ada", "Grace"] });
    });

    test("returns exists:false when encountering non-own property", () => {
        const proto = { inherited: 123 };
        const obj = Object.create(proto);
        // hasOwnProperty check should fail, so not traversable
        const result = getValueByPathWithExists(obj, "inherited");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("numeric-looking keys on objects are treated as normal keys", () => {
        const obj = { "0": { value: "zero" } };
        const result = getValueByPathWithExists(obj, "0.value");
        expect(result).toEqual({ exists: true, value: "zero" });
    });

    test("array index out of bounds returns exists:false", () => {
        const obj = { arr: [1, 2] };
        const result = getValueByPathWithExists(obj, "arr.5");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("stops early and returns exists:false if a mid-path segment is missing", () => {
        const obj = { a: { b: { c: 1 } } };
        const result = getValueByPathWithExists(obj, "a.x.c");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("empty path returns exists:false (cannot resolve empty key)", () => {
        const obj = { a: 1 };
        const result = getValueByPathWithExists(obj, "");
        expect(result).toEqual({ exists: false, value: undefined });
    });

    test("works when top-level is an array and key is non-numeric (fan-out at root)", () => {
        const obj = [{ user: { name: "Ada" } }, { user: { name: "Linus" } }, { user: {} }];
        const result = getValueByPathWithExists(obj, "user.name");
        expect(result).toEqual({ exists: true, value: ["Ada", "Linus"] });
    });

    test("works when top-level is an array and key is numeric (index at root)", () => {
        const obj = [{ name: "Ada" }, { name: "Linus" }];
        const result = getValueByPathWithExists(obj, "1.name");
        expect(result).toEqual({ exists: true, value: "Linus" });
    });

    test("handles deep object chain without arrays", () => {
        const obj = { a: { b: { c: { d: 7 } } } };
        const result = getValueByPathWithExists(obj, "a.b.c.d");
        expect(result).toEqual({ exists: true, value: 7 });
    });

    test("handles array with non-objects gracefully during fan-out", () => {
        const obj = { items: [null, 1, { k: "ok" }, "x", { k: "fine" }] };
        const result = getValueByPathWithExists(obj, "items.k");
        expect(result).toEqual({ exists: true, value: ["ok", "fine"] });
    });

    test("fan-out with deeper nested paths", () => {
        const obj = {
        rows: [
            { cells: [{ text: "A1" }, { text: "A2" }] },
            { cells: [{ text: "B1" }, {}] },
        ],
        };
        const result = getValueByPathWithExists(obj, "rows.cells.text");
        expect(result).toEqual({ exists: true, value: [["A1", "A2"], ["B1"]] });
    });
});

describe('merge', () => {
    test('should merge two simple objects', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        const mergedObj = merge([obj1, obj2]);
        expect(mergedObj).toEqual({ a: 1, b: 3, c: 4 });
    });

    test('should merge objects with nested objects', () => {
        const obj1 = { a: { b: 1 }, c: 2 };
        const obj2 = { a: { b: 2, d: 3 }, e: 4 };
        const mergedObj = merge([obj1, obj2]);
        expect(mergedObj).toEqual({ a: { b: 2, d: 3 }, c: 2, e: 4 });
    });

    test('should merge arrays', () => {
        const arr1 = [1, 2, 3];
        const arr2 = [4, 5, 6];
        const mergedArr = merge([arr1, arr2]);
        expect(mergedArr).toEqual([4, 5, 6]);
    });

    test('should merge arrays with nested arrays', () => {
        const arr1 = [1, [2, 3], 4];
        const arr2 = [5, [6, 7], 8];
        const mergedArr = merge([arr1, arr2]);
        expect(mergedArr).toEqual([5, [6, 7], 8]);
    });

    test('should merge objects with Date instances', () => {
        const date1 = new Date();
        const date2 = new Date(date1.getTime() + 1000);
        const obj1 = { a: date1 };
        const obj2 = { a: date2 };
        const mergedObj = merge([obj1, obj2]);
        expect(mergedObj).toEqual({ a: date2 });
    });

    test('should merge objects with undefined values', () => {
        const obj1 = { a: undefined };
        const obj2 = { b: 2 };
        const mergedObj = merge([obj1, obj2]);
        expect(mergedObj).toEqual({ b: 2 });
    });

    test('should merge objects with undefined values and preserveUndefined option', () => {
        const obj1 = { a: undefined };
        const obj2 = { b: 2 };
        const mergedObj = merge([obj1, obj2], { preserveUndefined: true });
        expect(mergedObj).toEqual({ a: undefined, b: 2 });
    });

    test('should merge objects without prototype', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        const mergedObj = merge([obj1, obj2]);
        expect(mergedObj).toEqual({ a: 1, b: 3, c: 4 });
        expect(mergedObj).not.toHavePrototype();
    });

    test('should merge objects with prototype', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 3, c: 4 };
        const mergedObj = merge([obj1, obj2], { preservePrototype: true });
        expect(mergedObj).toEqual({ a: 1, b: 3, c: 4 });
        expect(mergedObj).toHavePrototype();
    });
});

describe('unflatten', () => {
    test('should unflatten a simple object', () => {
        const flatObj = { 'a.b': 1, 'a.c': 2, d: 3 };
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({ a: { b: 1, c: 2 }, d: 3 });
    });

    test('should unflatten an object with arrays', () => {
        const flatObj = { 'a.0': 1, 'a.1': 2, 'b.c': 3 };
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({ a: [1, 2], b: { c: 3 } });
    });

    test('should unflatten an object with mixed keys', () => {
        const flatObj = { 'a.b.1': 2, 'a.b.0': 1, 'a.c': 3 };
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({ a: { b: [1, 2], c: 3 } });
    });

    test('should handle empty object', () => {
        const flatObj = {};
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({});
    });

    test('should handle object without dot notation', () => {
        const flatObj = { a: 1, b: 2 };
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({ a: 1, b: 2 });
    });

    test('should handle complex nested structures', () => {
        const flatObj = { 'a.b.c': 1, 'a.b.d.0': 2, 'a.b.d.1': 3, 'e': 4 };
        const nestedObj = unflatten(flatObj);
        expect(nestedObj).toEqual({ a: { b: { c: 1, d: [2, 3] } }, e: 4 });
    });
});

describe('pathValueToObject', () => {
    test('should convert simple path to object', () => {
        const result = pathValueToObject('a.b.c', 42);
        expect(result).toEqual({ a: { b: { c: 42 } } });
    });

    test('should handle numeric segments as array indices', () => {
        const result = pathValueToObject('a.0.b', 'value');
        expect(result).toEqual({ a: [{ b: 'value' }] });
    });

    test('should handle multiple numeric segments', () => {
        const result = pathValueToObject('x.1.y.2', true);
        expect(result).toEqual({ x: [ , { y: [ , , true ] } ] });
    });

    test('should handle single segment paths', () => {
        const result = pathValueToObject('key', 'val');
        expect(result).toEqual({ key: 'val' });
    });

    test('should handle empty path', () => {
        const result = pathValueToObject('', 123);
        expect(result).toEqual({ '': 123 });
    });

    describe('numeric property names that are not meant to be arrays', () => {
        test('should treat numeric-looking keys as normal object keys - suffix', () => {
            const result = pathValueToObject('a.b0.c', 'value',);
            expect(result).toEqual({ a: { b0: { c: 'value' } } });
        });

        test('should treat numeric-looking keys as normal object keys - prefix', () => {
            const result = pathValueToObject('a.0b.c', 'value',);
            expect(result).toEqual({ a: { '0b': { c: 'value' } } });
        });
    });
});