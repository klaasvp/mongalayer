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

type PathValueToObjectOptions = {
    allowPositionalDollar?: boolean
};

export function pathValueToObject (key: string, value: unknown, options: PathValueToObjectOptions = {}): Record<string, unknown> {
    options = { allowPositionalDollar: false, ...options };

    return key.split(".").reduceRight((acc, part) => {
        if (/^\d+$/.test(part)) {
            const array = new Array(+part + 1);
            array[+part] = acc;
            return array;
        } else if (options.allowPositionalDollar === true && part === "$") {
            const array = [];
            array[0] = acc;
            return array;
        } else {
            return { [part]: acc }
        } 
    }, value) as Record<string, unknown>;
}

type UnflattenOptions = PathValueToObjectOptions;

export function unflatten(source: Record<string, unknown>, options: UnflattenOptions = {}): Record<string, unknown> {
    options = { allowPositionalDollar: false, ...options };

    const toUnflatten = structuredClone(source);
    const toMerge: any[] = [];

    for (const [key, value] of Object.entries(toUnflatten)) {
        if (/\./.test(key)) {
            const mergable = pathValueToObject(key, value, options);
            toMerge.push(mergable);
            delete toUnflatten[key];
        }
    }

    toMerge.push(toUnflatten);

    return merge(toMerge);
}

type MergeOptions = {
    preservePrototype?: boolean,
    preserveUndefined?: boolean
};

export function merge (sources: any[], options: MergeOptions = {}): any {
    options = { 
        preservePrototype: false, 
        preserveUndefined: false,
        ...options
    };

    let copy: any = null;

    if (sources.length > 0) {
        if (isObject(sources[0])) {
            copy = options.preservePrototype === true ? {} : Object.create(null);

            for (var i = 0, il = sources.length; i < il; i++) {
                deepCopy(copy, sources[i], options);
            }
        } else if (Array.isArray(sources[0])) {
            copy = [];

            for (var i = 0, il = sources.length; i < il; i++) {
                deepCopyArray(copy, sources[i], options);
            }
        } else {
            copy = sources[sources.length - 1];
        }
    }

    return copy;
}

function deepCopyArray (target: any[], source: any[], options: MergeOptions = { preservePrototype: false, preserveUndefined: false }): any[] {
    if (typeof target === "undefined") target = [];

    const keys = Object.keys(source);

    for (let i = 0; i < keys.length; i++) {
        const k = +keys[i], cur = source[k];

        if (typeof cur !== 'object' || cur === null) {
            target[k] = cur;
        } else if (cur instanceof Date) {
            target[k] = new Date(cur);
        } else {
            target[k] = deepCopy(target[k], cur, options);
        }
    }

    return target;
}

function deepCopy (target: any, source: any, options: MergeOptions = { preservePrototype: false, preserveUndefined: false }): any {
    if (typeof source !== 'object' || source === null) return source;

    if (source instanceof Date) return new Date(source);

    if (Array.isArray(source)) return deepCopyArray(target, source, options);

    if (typeof target === "undefined" || target === null) target = options.preservePrototype === true ? {} : Object.create(null);

    for (const k in source) {
        if (Object.hasOwnProperty.call(source, k) === false) continue;

        if (source[k] === void 0) {
            if (options.preserveUndefined === true) {
                target[k] = void 0;
            }

            continue;
        }

        const cur = source[k];

        if (typeof cur !== 'object' || cur === null) {
            target[k] = cur;
        } else if (cur instanceof Date) {
            target[k] = new Date(cur);
        } else {
            target[k] = deepCopy(target[k], cur, options);
        }
    }

    return target;
}