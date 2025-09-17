import { describe, expect, test } from "vitest";
import { getValueByPathWithExists } from "#src/utils/object.js";

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