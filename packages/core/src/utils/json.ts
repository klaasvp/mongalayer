export function stringifyReplacer (this: any, key: string, value: any) {
    if (this[key] instanceof Date) {
        return { __$date: this[key].getTime() };
    } else if (this[key] instanceof RegExp) {
        return this[key].toString();
    }
    
    return value;
}

export function parseReviver (this: any, key: string, value: any) {
    if (value && value.__$date !== void 0) {
        return new Date(value.__$date);
    }

    return value;
}