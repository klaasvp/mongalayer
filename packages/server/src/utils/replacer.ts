type IterateCallbackReplacer = (newValue: any) => void;
export type IterateCallback = (key: string | number, value: any, replace: IterateCallbackReplacer) => void;

type IteratePrimitives = "string" | "number" | "boolean";

const isArray = (array: unknown): array is unknown[] => Array.isArray(array);
const isObject = (obj: unknown): obj is Record<string, unknown> => Object.prototype.toString.call(obj) === "[object Object]";

export function iteratePrimitives (instance: any[] | Record<string, unknown>, callback: IterateCallback, primitives: IteratePrimitives[] = ["string", "number", "boolean"]) {
    const entries: [string | number, any][] = [];

    if (isArray(instance)) {
        entries.push(...instance.entries());
    } else if (isObject(instance)) {
        entries.push(...Object.entries(instance));
    } 

    if (entries.length > 0) {
        for (const [key, value] of entries) {
            if ((primitives as string[]).includes(typeof value)) {
                callback(key, value, (newValue) => {
                    (instance as any)[key] = newValue;
                });
            } else if (isArray(value) || isObject(value)) {
                iteratePrimitives(value, callback, primitives);
            }
        }
    }
}
