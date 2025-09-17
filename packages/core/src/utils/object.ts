export const isArray = (array: unknown): array is unknown[] => Array.isArray(array);

export const isObject = (obj: unknown): obj is Record<string, unknown> => Object.prototype.toString.call(obj) === "[object Object]";

const isObjectOrArray = (value: unknown): value is unknown[] | Record<string, unknown> => Array.isArray(value) || isObject(value);

export const deleteObjectProperty = (path: string, obj: Record<string, unknown>) => {
    const keys = path.split(".").reverse();

    let last: Record<string, any> = obj;

    do {
        const key = keys.pop()!;

        if (keys.length === 0) delete last[key];
        else last = last[key];
    } while (last !== void 0 && keys.length > 0);
};

export function getValueByPath(obj: Record<string, any>, path: string): any | undefined {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
}

/**
 * Mimic MongoDB dot notation for embedded documents and array & also return if the property exists or not
 */
export function getValueByPathWithExists(obj: Record<string, any> | unknown[], path: string): { exists: true, value: any } | { exists: false, value: undefined } {
    const keys = path.split('.');

    let current: any = obj;

    do {
        const key = keys.shift() as string;

        if (Array.isArray(current) && !/^\d+$/.test(key)) {
            return { 
                exists: true, 
                value: current.map((item) => {
                    if (isObjectOrArray(item)) return getValueByPathWithExists(item, [key, ...keys].join("."));
                    else return { exists: false, value: void 0 };
                }).filter(item => item.exists === true).map(item => item.value!) // Only return matching items
            };
        } else if (isObjectOrArray(current) && Object.prototype.hasOwnProperty.call(current, key)) {
            current = (current as any)[key];
        } else {
            return { exists: false, value: void 0 };
        }
    } while (keys.length > 0);

    return { exists: true, value: current };
}

export function typedEntries <T extends object> (obj: T): { [K in keyof T]-?: [K, T[K]] }[keyof T][] {
    return Object.entries(obj) as any;
}