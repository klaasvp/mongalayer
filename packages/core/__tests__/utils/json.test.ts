import { describe, expect, vi, test } from "vitest";
import { parseReviver, stringifyReplacer } from '#src/utils/json';

describe('json replacer', () => {
    test('should replace Date objects with a custom format', () => {
        const date = new Date();
        const obj = { a: date, b: 'hello' };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify({ a: { __$date: date.getTime() }, b: 'hello' }));
    });

    test('should replace RegExp objects with flags', () => {
        const regex = /test/gi;
        const obj = { a: { $regex: regex }, b: 'hello' };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify({ a: { $regex: 'test', $options: 'gi' }, b: 'hello' }));
    });

    test('should replace RegExp objects without flags', () => {
        const regex = /test/;
        const obj = { a: { $regex: regex }, b: 'hello' };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify({ a: { $regex: 'test' }, b: 'hello' }));
    });
    
    test('should not modify regular objects', () => {
        const obj = { a: 'hello', b: 123 };
        const result = JSON.stringify(obj, stringifyReplacer);

        expect(result).toBe(JSON.stringify(obj));
    });
    
    test('should not modify deeply nested objects and arrays', () => {
        const obj = { a: { b: [1, 2, { c: 'hello' }] }, d: 123 };
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