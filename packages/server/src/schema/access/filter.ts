import { isObject } from "@mongalayer/core";
import * as z from "zod";

type Value = string | number | boolean | null //| Value[] | { [key: string]: Value };

export const propertyOperatorKeys = [
    "$eq", "$in", "$ne", "$nin", "$exists"
] as const;

export type PropertyOperatorKey = typeof propertyOperatorKeys[number];

export const isPropertyOperatorKey = (key: string): key is PropertyOperatorKey => {
    return propertyOperatorKeys.includes(key as any);
};

export const customOperatorKeys = [
    "$$eq", "$$in", "$$ne", "$$nin"
] as const;

export type CustomOperatorKey = typeof customOperatorKeys[number];

export const isCustomOperatorKey = (key: string): key is CustomOperatorKey => {
    return customOperatorKeys.includes(key as any);
};

export const logicalOperatorKeys = [
    "$and", "$or", "$nor"
] as const;

export type LogicalOperatorKey = typeof logicalOperatorKeys[number];

export const isLogicalOperatorKey = (key: string): key is LogicalOperatorKey => {
    return logicalOperatorKeys.includes(key as any);
};

export const rootOperatorKeys = [ 
    ...logicalOperatorKeys,
    ...customOperatorKeys
] as const;

const valueToHydrate = z.string().regex(/^%%/);

const valueSchema: z.ZodType<Value> = /*z.lazy(() =>*/ z.union([
    valueToHydrate,
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    //z.array(valueSchema),
    //z.record(z.string(), valueSchema)
])//);

const accessFilterOperatorsSchema = z.strictObject({
    $eq: valueSchema,
    $in: valueSchema.array().or(valueToHydrate),
    $ne: valueSchema,
    $nin: valueSchema.array().or(valueToHydrate),
    $exists: z.boolean().or(valueToHydrate),
}).partial();

export type AccessFilterPropertyOperators = z.infer<typeof accessFilterOperatorsSchema>;

export const hasAccessFilterPropertyOperators = (value: Value | AccessFilterPropertyOperators | unknown[]): value is AccessFilterPropertyOperators => {
    return isObject(value) && Object.keys(value).some(key => propertyOperatorKeys.includes(key as any));
};

export type AccessFilterPropertyValue = Value | AccessFilterPropertyOperators;
export type AccessFilterExpressions = {
    $and?: AccessFilter[],
    $nor?: AccessFilter[],
    $or?: AccessFilter[],
    
    $$eq?: [ Value, Value ],
    $$in?: [ Value | Value[], string | Value[] ],
    $$ne?: [ Value, Value ],
    $$nin?: [ Value | Value[], string | Value[] ]
}

export type AccessFilter = AccessFilterExpressions & {
    [prop: string]: AccessFilterPropertyValue 
        | unknown[] // This is to support typecompletion for the root operator types 
}

export const accessFilterSchema: z.ZodType<AccessFilter> = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and () { return z.lazy(() => z.array(accessFilterSchema).min(1)) },
        get $nor () { return z.lazy(() => z.array(accessFilterSchema).min(1)) },
        get $or () { return z.lazy(() => z.array(accessFilterSchema).min(1)) },

        $$eq: z.tuple([valueSchema, valueSchema]),
        $$in: z.tuple([z.union([valueSchema, valueSchema.array()]), z.union([valueToHydrate, valueSchema.array()])]),
        $$ne: z.tuple([valueSchema, valueSchema]),
        $$nin: z.tuple([z.union([valueSchema, valueSchema.array()]), z.union([valueToHydrate, valueSchema.array()])])
    }).partial().catchall(z.union([
        valueSchema,
        accessFilterOperatorsSchema
    ])).refine(
        (data) => Object.keys(data).every(key => !key.startsWith("$") || rootOperatorKeys.includes(key as any)),
        { message: "Invalid filter root operator" }
    )

