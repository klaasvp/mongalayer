export function stringifyReplacer (this: any, key: string, value: any) {
    if (this[key] instanceof Date) {
        return { __$date: this[key].getTime() };
    } else if (this[key] instanceof RegExp) {
        if (typeof this[key].flags === "string" && this[key].flags.length > 0) {
            this.$options = this[key].flags;
        }
        return this[key].source;
    }
    
    return value;
}

export function parseReviver (this: any, key: string, value: any) {
    if (value && value.__$date !== void 0) {
        return new Date(value.__$date);
    }

    return value;
}