import { getValueByPathWithExists, isObject, typedEntries } from "@mongalayer/core";
import { AccessFilter, AccessFilterPropertyOperators, AccessFilterPropertyValue, propertyOperatorKeys, rootOperatorKeys } from "../schema/access/filter.js";
import type { Document } from "mongodb";

export const isPrimitive = (value: string): boolean => {
    return ["string", "number", "boolean", "null", "undefined"].includes(value.slice(8, -1).toLowerCase()); // Removed "[object" & "]" from [object Type]
};

export function deepEqual (a: any, b: any): boolean {
    const 
        typeA = Object.prototype.toString.call(a),
        typeB = Object.prototype.toString.call(b);

    if (typeA !== typeB) return false;

    if (isPrimitive(typeA)) return a === b; // Strict equal comparison for primitives

    // All that remains now are Dates, Arrays & Objects

    if ("[object Date]" === typeA) return a.getTime() === b.getTime();

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;

        return true;
    }

    if (isObject(a) && isObject(b)) {
        const keysA = Object.keys(a), keysB = Object.keys(b);

        if (keysA.length !== keysB.length) return false;

        for (const k of keysA) {
            if (!keysB.includes(k)) return false;
            if (!deepEqual(a[k], b[k])) return false;
        }

        return true;
    }

    // Everything else is unsupported and should return false
    return false;
}

function $in(fieldValue: any, candidates: any[]): boolean {
    if (Array.isArray(fieldValue)) {
        return fieldValue.some((el) => candidates.some((c) => deepEqual(el, c)));
    }

    return candidates.some((c) => deepEqual(fieldValue, c));
}

function $nin(fieldValue: any, candidates: any[]): boolean {
    if (Array.isArray(fieldValue)) {
        return fieldValue.every((el) => candidates.every((c) => !deepEqual(el, c)));
    }

    return candidates.every((c) => !deepEqual(fieldValue, c));
}

function matchesFieldCondition(keyValue: any, cond: AccessFilterPropertyValue, exists: boolean, doc: Document): boolean {
    // Bare value means implicit $eq
    if (isObject(cond) && Object.keys(cond).every((k) => propertyOperatorKeys.includes(k))) {
        const results: boolean[] = [], operators = typedEntries(cond as AccessFilterPropertyOperators);

        for (const [ operator, value ] of operators) {
            switch (operator) {
                case "$eq": results.push(exists && deepEqual(keyValue, value)); break;
                case "$ne": results.push(!(exists && deepEqual(keyValue, value))); break;
                case "$exists": results.push(exists === value); break;
                case "$in": {
                    if (!exists || !Array.isArray(value)) results.push(false);
                    else results.push($in(keyValue, value));
                    break;
                }
                case "$nin": {
                    if (!Array.isArray(value)) results.push(false);
                    else if (!exists) results.push(true);
                    else results.push($nin(keyValue, value));
                    break;
                }
            }
        }

        return results.every(r => r === true);
    } 

    return deepEqual(keyValue, cond);
}

export function matches(doc: Document, filter: AccessFilter): boolean {
    const results: boolean[] = [];

    for (const rootOperator of rootOperatorKeys) {
        if (Object.prototype.hasOwnProperty.call(filter, rootOperator)) {
            switch (rootOperator) {
                case "$and": results.push(filter.$and!.every((f) => matches(doc, f))); break;
                case "$or": results.push(filter.$or!.some((f) => matches(doc, f))); break;
                case "$nor": results.push(filter.$nor!.every((f) => !matches(doc, f))); break;
                case "$$eq": results.push(matchesFieldCondition(filter.$$eq![0], { $eq: filter.$$eq![1] }, true, doc)); break;
                case "$$ne": results.push(matchesFieldCondition(filter.$$ne![0], { $ne: filter.$$ne![1] }, true, doc)); break;
                case "$$in": results.push(matchesFieldCondition(filter.$$in![0], { $in: filter.$$in![1] }, true, doc)); break;
                case "$$nin": results.push(matchesFieldCondition(filter.$$nin![0], { $nin: filter.$$nin![1] }, true, doc)); break;
            }
        }
    }

    const remainingKeys = Object.keys(filter).filter(key => !rootOperatorKeys.includes(key as any));

    // Otherwise treat keys as field conditions
    for (const key of remainingKeys) {
        if (key.startsWith("$")) {
            results.push(false);
        } else {
            const { value: keyValue, exists } = getValueByPathWithExists(doc, key);

            results.push(matchesFieldCondition(keyValue, filter[key] as AccessFilterPropertyValue, exists, doc));
        }
    }

    return results.every(r => r === true);
}
