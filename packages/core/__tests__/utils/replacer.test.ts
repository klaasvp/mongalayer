import { describe, expect, vi, test } from "vitest";
import { IterateCallback, iteratePrimitives } from '#src/utils/replacer';

describe('iteratePrimitives', () => {
    test('should iterate over string primitives in an object', () => {
        const obj = { a: 'hello', b: 123, c: true };
        const callback = vi.fn<IterateCallback>((key, value, replace) => {
            if (typeof value === 'string') {
                replace(value.toUpperCase());
            } else if (typeof value === "number") {
                replace(value * 2);
            }
        });

        iteratePrimitives(obj, callback);

        expect(callback).toHaveBeenCalledTimes(3);
        expect(obj).toEqual({ a: 'HELLO', b: 246, c: true });
    });

    test('should iterate over number primitives in an array', () => {
        const arr = [1, 'hello', 3.14];
        const callback = vi.fn<IterateCallback>((key, value, replace) => {
            if (typeof value === 'number') {
                replace(value * 2);
            }
        });

        iteratePrimitives(arr, callback);

        expect(callback).toHaveBeenCalledTimes(3);
        expect(arr).toEqual([2, 'hello', 6.28]);
    });

    test('should iterate over boolean primitives in a nested object', () => {
        const obj = { a: { b: true, c: false }, d: 'hello', e: 1 };
        const callback = vi.fn<IterateCallback>((key, value, replace) => {
            if (typeof value === 'boolean') {
                replace(!value);
            }
        });

        iteratePrimitives(obj, callback);

        expect(callback).toHaveBeenCalledTimes(4);
        expect(obj).toEqual({ a: { b: false, c: true }, d: 'hello', e: 1 });
    });

    test('should not modify non-primitive values', () => {
        const obj = { a: { b: 'nested' }, c: [1, 2, 3] };
        const callback = vi.fn<IterateCallback>((key, value, replace) => {
            if (typeof value === 'string') {
                replace(value.toUpperCase());
            } else if (typeof value === "number") {
                replace(value * 2);
            }
        });

        iteratePrimitives(obj, callback);

        expect(callback).toHaveBeenCalledTimes(4);
        expect(obj).toEqual({ a: { b: 'NESTED' }, c: [2, 4, 6] });
    });

    test('should handle empty objects and arrays', () => {
        const obj = {};
        const arr: any[] = [];
        const callback = vi.fn<IterateCallback>();

        iteratePrimitives(obj, callback);
        iteratePrimitives(arr, callback);

        expect(callback).not.toHaveBeenCalled();
    });

    test('should handle custom primitives list', () => {
        const obj = { a: 'hello', b: 123, c: true };
        const callback = vi.fn<IterateCallback>((key, value, replace) => {
            if (typeof value === 'string') {
                replace(value.toUpperCase());
            }
        });

        iteratePrimitives(obj, callback, ['string']);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(obj).toEqual({ a: 'HELLO', b: 123, c: true });
    });
});