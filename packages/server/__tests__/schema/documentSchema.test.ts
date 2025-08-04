import { documentSchema } from '#src/schema/query.js'; // Adjust the import path as needed
import { describe, expect, test } from 'vitest';

describe('documentSchema', () => {
  test('should invalidate a string', () => {
    const result = documentSchema.safeParse('Hello, World!');
    expect(result.success).toBe(false);
  });

  test('should invalidate a number', () => {
    const result = documentSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  test('should invalidate a boolean', () => {
    const result = documentSchema.safeParse(true);
    expect(result.success).toBe(false);
  });

  test('should invalidate null', () => {
    const result = documentSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  test('should invalidate an array of valid values', () => {
    const result = documentSchema.safeParse([1, 'two', true, null]);
    expect(result.success).toBe(false);
  });

  test('should validate an object with valid values', () => {
    const result = documentSchema.safeParse({ key: 'value', num: 42, bool: false });
    expect(result.success).toBe(true);
  });

  test('should validate a nested object', () => {
    const result = documentSchema.safeParse({ nested: { key: 'value' } });
    expect(result.success).toBe(true);
  });

  test('should invalidate a known operator', () => {
    const result = documentSchema.safeParse({ nested: { $gt: 0 } });
    expect(result.success).toBe(false);
  });

  test('should invalidate a unknown "$" property', () => {
    const result = documentSchema.safeParse({ nested: { $test: 0 } });
    expect(result.success).toBe(false);
  });

  test('should invalidate a date', () => {
    const result = documentSchema.safeParse(new Date());
    expect(result.success).toBe(false);
  });

  test('should invalidate an undefined value', () => {
    const result = documentSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  test('should invalidate a function', () => {
    const result = documentSchema.safeParse(() => {});
    expect(result.success).toBe(false);
  });

  test('should invalidate an array containing an invalid value', () => {
    const result = documentSchema.safeParse([1, 'two', () => {}]);
    expect(result.success).toBe(false);
  });

  test('should invalidate an object containing an invalid value', () => {
    const result = documentSchema.safeParse({ key: 'value', invalid: () => {} });
    expect(result.success).toBe(false);
  });

  test('should invalidate a nested object containing an invalid value', () => {
    const result = documentSchema.safeParse({ nested: { invalid: () => {} } });
    expect(result.success).toBe(false);
  });
});