export const isArray = (array: unknown): array is unknown[] => Array.isArray(array);

export const isObject = (obj: unknown): obj is Record<string, unknown> => Object.prototype.toString.call(obj) === "[object Object]";

export const deleteObjectProperty = (path: string, obj: Record<string, unknown>) => {
    const keys = path.split(".").reverse();

    let last: Record<string, any> = obj;

    do {
        const key = keys.pop()!;

        if (keys.length === 0) delete last[key];
        else last = last[key];
    } while (last !== void 0 && keys.length > 0);
};