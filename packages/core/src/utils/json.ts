export function stringifyReplacer (this: any, key: string, value: any) {
    if (this[key] instanceof Date) {
        return { __$date: this[key].getTime() };
    } else if (Object.prototype.toString.call(this[key]) === "[object Object]" && this[key].$regex instanceof RegExp) {
        const replacement = { ...this[key], $regex: this[key].$regex.source };
        if (typeof this[key].$regex.flags === "string" && this[key].$regex.flags.length > 0) {
            replacement.$options = this[key].$regex.flags;
        }
        return replacement;
    }
    
    return value;
}

export function parseReviver (this: any, key: string, value: any) {
    if (value && value.__$date !== void 0) {
        return new Date(value.__$date);
    }

    return value;
}