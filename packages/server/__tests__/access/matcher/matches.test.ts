import { matches } from "#src/access/matcher.js";
import { AccessFilter } from "#src/schema/access/filter.js";
import { describe, expect, test } from "vitest";

describe('matches', () => {
    const doc = {
        name: 'Alice',
        age: 30,
        tags: ['admin', 'beta'],
        active: true,
        notes: null,
        address: { city: 'Ghent', zip: 9000 },
        meta: {
            createdAt: new Date('2024-01-01T00:00:00Z'),
            scores: [1, 2, 3],
        }
    };

    test('field equality (implicit $eq)', () => {
        expect(matches(doc, { name: 'Alice' })).toBe(true);
        expect(matches(doc, { age: 31 })).toBe(false);
    });

    test('$eq with primitives and nested paths', () => {
        expect(matches(doc, { age: { $eq: 30 } })).toBe(true);
        expect(matches(doc, { 'address.city': { $eq: 'Ghent' } })).toBe(true);
        expect(matches(doc, { 'address.city': { $eq: 'Bruges' } })).toBe(false);
    });

    test('$ne on existing and missing fields', () => {
        expect(matches(doc, { age: { $ne: 25 } })).toBe(true); // 30 !== 25
        expect(matches(doc, { age: { $ne: 30 } })).toBe(false); // equal, so $ne fails
        expect(matches(doc, { 'address.country': { $ne: 'BE' } })).toBe(true); // Missing -> true
    });

    test('$exists distinguishes missing vs present (even if null)', () => {
        expect(matches(doc, { notes: { $exists: true } })).toBe(true);          // present & null
        expect(matches(doc, { 'address.country': { $exists: false } })).toBe(true); // missing
        expect(matches(doc, { 'address.city': { $exists: false } })).toBe(false);   // present
    });

    test('$in with scalar and array fields', () => {
        // scalar field
        expect(matches(doc, { age: { $in: [29, 30, 31] } })).toBe(true);
        expect(matches(doc, { age: { $in: [28, 29] } })).toBe(false);

        // array field: true if ANY element is in set
        expect(matches(doc, { tags: { $in: ['guest', 'admin'] } })).toBe(true);
        expect(matches(doc, { tags: { $in: ['guest'] } })).toBe(false);

        // missing field + $in -> false
        expect(matches(doc, { 'address.country': { $in: ['BE', 'NL'] } })).toBe(false);
    });

    test('$nin with scalar and array fields, and missing semantics', () => {
        // scalar field
        expect(matches(doc, { age: { $nin: [31, 32] } })).toBe(true);
        expect(matches(doc, { age: { $nin: [30, 31] } })).toBe(false);

        // array field: true if NONE of the elements are in the set
        expect(matches(doc, { tags: { $nin: ['guest'] } })).toBe(true);
        expect(matches(doc, { tags: { $nin: ['guest', 'admin'] } })).toBe(false); 
        expect(matches(doc, { tags: { $nin: ['admin'] } })).toBe(false);

        // missing field + $nin -> true (by design in your implementation)
        expect(matches(doc, { 'address.country': { $nin: ['BE'] } })).toBe(true);
    });

    test('$and - all subfilters must pass', () => {
        expect(matches(doc, {
            $and: [
                { age: { $in: [28, 29, 30] } }, 
                { 'address.city': 'Ghent' }
            ],
        })).toBe(true);

        expect(matches(doc, {
            $and: [
                { age: { $in: [28, 29] } }, 
                { 'address.city': 'Ghent' }
            ],
        })).toBe(false);
    });

    test('$or - any subfilter passes', () => {
        expect(matches(doc, {
            $or: [
                { name: 'Bob' }, 
                { tags: { $in: ['admin'] } }
            ],
        })).toBe(true);

        expect(matches(doc, {
            $or: [
                { name: 'Bob' }, 
                { age: 31 }
            ],
        })).toBe(false);
    });

    test('$nor - none of the subfilters may pass', () => {
        expect(matches(doc, {
            $nor: [
                { name: 'Bob' }, 
                { age: 25 }
            ],
        })).toBe(true);

        expect(matches(doc, {
            $nor: [
                { name: 'Bob' }, 
                { age: 30 }
            ],
        })).toBe(false); 

        expect(matches(doc, {
            $nor: [
                { name: 'Alice' }, 
                { age: 30 }
            ],
        })).toBe(false);
    });

    test('dot path into arrays/objects', () => {
        expect(matches(doc, { 'meta.scores': { $in: [2] } })).toBe(true);
        expect(matches(doc, { 'meta.scores': { $nin: [4, 5] } })).toBe(true);
        expect(matches(doc, { 'meta.scores': { $nin: [3] } })).toBe(false);
    });

    describe('root value operators ($$eq/$$ne/$$in/$$nin)', () => {
        test('$$eq / $$ne with primitives', () => {
            expect(matches(doc, { $$eq: [10, 10] })).toBe(true);
            expect(matches(doc, { $$eq: [10, 11] })).toBe(false);
            expect(matches(doc, { $$ne: [10, 11] })).toBe(true);
            expect(matches(doc, { $$ne: [10, 10] })).toBe(false);
        });

        test('$$in / $$nin work like field ops but on provided values', () => {
            expect(matches(doc, { $$in: ['a', ['a', 'b', 'c']] })).toBe(true);
            expect(matches(doc, { $$in: [3, [1, 2, 3]] })).toBe(true);
            expect(matches(doc, { $$in: ['x', ['a', 'b', 'c']] })).toBe(false);

            expect(matches(doc, { $$nin: ['x', ['a', 'b', 'c']] })).toBe(true);
            expect(matches(doc, { $$nin: ['a', ['a', 'b', 'c']] })).toBe(false);

            // array "left value" behaves like a field array (true if ANY element is in set for $$in)
            expect(matches(doc, { $$in: [['a', 'b'], ['x', 'b', 'y']] })).toBe(true);
            expect(matches(doc, { $$in: [['a', 'b'], ['x', 'z', 'y']] })).toBe(false);
            // and for $$nin, ALL elements must be outside the set
            expect(matches(doc, { $$nin: [['a', 'b'], ['x', 'y', 'z']] })).toBe(true);
            expect(matches(doc, { $$nin: [['a', 'b'], ['x', 'y', 'a']] })).toBe(false);
        });
    });

    test('complex filter mix', () => {
        const filter: AccessFilter = {
            $and: [
                { 'address.city': 'Ghent' },
                { tags: { $in: ['admin'] } },
                { $or: [
                    { age: { $eq: 30 } },
                    { age: { $in: [28, 29] } },
                ]},
            ],
            active: { $exists: true },
            'address.country': { $exists: false },
            name: { $ne: 'Bob' },
        };

        expect(matches(doc, filter)).toBe(true);
    });

    test('missing field with bare value behaves like $eq (should fail)', () => {
        expect(matches(doc, { 'missing.path': 123 })).toBe(false);
    });

    test('field starting with $ is treated as invalid and fails closed', () => {
        expect(matches(doc, { $weirdField: 1 })).toBe(false);
    });
});
