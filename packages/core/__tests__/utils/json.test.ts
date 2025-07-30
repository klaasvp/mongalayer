import { describe, expect, vi, test } from "vitest";
import { parseReviver, stringifyReplacer } from '#src/utils/json';

describe('json replacer', () => {
    test('should replace Date objects with a custom format', () => {
        const date = new Date();
        const obj = { a: date, b: 'hello' };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify({ a: { __$date: date.getTime() }, b: 'hello' }));
    });
    
    test('should not modify non-Date objects', () => {
        const obj = { a: 'hello', b: 123 };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify(obj));
    });
});

describe('json reviver', () => {
    test('should replace custom date format with Date objects', () => {
        const date = new Date();
        const obj = { a: { __$date: date.getTime() }, b: 'hello' };
        const result = JSON.parse(JSON.stringify(obj), parseReviver);

        expect(result.a).toBeInstanceOf(Date);
        expect(result.a.getTime()).toBe(date.getTime());
    });

    test('should not modify non-date objects', () => {
        const obj = { a: 'hello', b: 123 };
        const result = JSON.parse(JSON.stringify(obj), parseReviver);

        expect(result).toStrictEqual(obj);
    });
});