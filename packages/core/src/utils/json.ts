export function stringifyReplacer (this: any, key: string, value: any) {
    if (this[key] instanceof Date) {
        return { __$date: this[key].getTime() };
    }
    
    return value;
}

export function parseReviver (this: any, key: string, value: any) {
    if (value && value.__$date !== void 0) {
        return new Date(value.__$date);
    }

    return value;
}