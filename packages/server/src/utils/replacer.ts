import { isArray, isObject } from "./core.js";

type IterateCallbackReplacer = (newValue: any) => void;
export type IterateCallback = (key: string | number, value: any, replace: IterateCallbackReplacer, path: string[], parent: any[] | Record<string, unknown>) => void;

type IteratePrimitives = "string" | "number" | "boolean";

export function iteratePrimitives (instance: any[] | Record<string, unknown>, callback: IterateCallback, primitives: IteratePrimitives[] = ["string", "number", "boolean"], path: string[] = []) {
    const entries: [string | number, any][] = [];

    if (isArray(instance)) {
        entries.push(...instance.entries());
    } else if (isObject(instance)) {
        entries.push(...Object.entries(instance));
    } 

    if (entries.length > 0) {
        for (const [key, value] of entries) {
            const valuePath = [...path, key.toString()];

            if ((primitives as string[]).includes(typeof value)) {
                callback(key, value, (newValue) => {
                    (instance as any)[key] = newValue;
                }, valuePath, instance);
            } else if (isArray(value) || isObject(value)) {
                iteratePrimitives(value, callback, primitives, valuePath);
            }
        }
    }
}
