import { z } from "zod";

type Value = string | number | boolean | null;

export const propertyOperatorKeys = [
    "$eq", "$in", "$ne", "$nin", "$exists"
];

export const customOperatorKeys = [
    "$$eq", "$$in", "$$ne", "$$nin"
] as const;

export const rootOperatorKeys = [ 
    "$and", "$or", "$nor",
    ...customOperatorKeys
] as const;

const valueToHydrate = z.string().regex(/^%%/);

const valueSchema: z.ZodType<Value> = z.union([
    valueToHydrate,
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
]);

const accessFilterOperatorsSchema = z.strictObject({
    $eq: valueSchema,
    $in: valueSchema.array().or(valueToHydrate),
    $ne: valueSchema,
    $nin: valueSchema.array().or(valueToHydrate),
    $exists: z.boolean().or(valueToHydrate),
}).partial();

export type AccessFilterPropertyOperators = z.infer<typeof accessFilterOperatorsSchema>;
export type AccessFilterPropertyValue = Value | AccessFilterPropertyOperators;

export type AccessFilter = {
    $and?: AccessFilter[],
    $nor?: AccessFilter[],
    $or?: AccessFilter[],
    
    $$eq?: [ Value, Value ],
    $$in?: [ Value | Value[], string | Value[] ],
    $$ne?: [ Value, Value ],
    $$nin?: [ Value | Value[], string | Value[] ]
} & {
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

