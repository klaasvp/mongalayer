export const isArray = (array: unknown): array is unknown[] => Array.isArray(array);

export const isObject = (obj: unknown): obj is Record<string, unknown> => Object.prototype.toString.call(obj) === "[object Object]";