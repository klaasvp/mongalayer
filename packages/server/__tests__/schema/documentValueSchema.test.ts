import { documentValueSchema } from '#src/actions/schema.js'; // Adjust the import path as needed
import { describe, expect, test } from 'vitest';

describe('documentValueSchema', () => {
  test('should validate a string', () => {
    const result = documentValueSchema.safeParse('Hello, World!');
    expect(result.success).toBe(true);
  });

  test('should validate a number', () => {
    const result = documentValueSchema.safeParse(42);
    expect(result.success).toBe(true);
  });

  test('should validate a boolean', () => {
    const result = documentValueSchema.safeParse(true);
    expect(result.success).toBe(true);
  });

  test('should validate null', () => {
    const result = documentValueSchema.safeParse(null);
    expect(result.success).toBe(true);
  });

  test('should validate an array of valid values', () => {
    const result = documentValueSchema.safeParse([1, 'two', true, null]);
    expect(result.success).toBe(true);
  });

  test('should validate an object with valid values', () => {
    const result = documentValueSchema.safeParse({ key: 'value', num: 42, bool: false });
    expect(result.success).toBe(true);
  });

  test('should validate a nested object', () => {
    const result = documentValueSchema.safeParse({ nested: { key: 'value' } });
    expect(result.success).toBe(true);
  });

  test('should invalidate a date', () => {
    const result = documentValueSchema.safeParse(new Date());
    expect(result.success).toBe(false);
  });

  test('should invalidate an undefined value', () => {
    const result = documentValueSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  test('should invalidate a function', () => {
    const result = documentValueSchema.safeParse(() => {});
    expect(result.success).toBe(false);
  });

  test('should invalidate an array containing an invalid value', () => {
    const result = documentValueSchema.safeParse([1, 'two', () => {}]);
    expect(result.success).toBe(false);
  });

  test('should invalidate an object containing an invalid value', () => {
    const result = documentValueSchema.safeParse({ key: 'value', invalid: () => {} });
    expect(result.success).toBe(false);
  });

  test('should invalidate a nested object containing an invalid value', () => {
    const result = documentValueSchema.safeParse({ nested: { invalid: () => {} } });
    expect(result.success).toBe(false);
  });
});