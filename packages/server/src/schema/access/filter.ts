import { z } from "zod/v4";

type Value = string | number | boolean | null;

const rootOperatorKeys = [ 
    "$and", "$or", "$nor",
    "$$eq", "$$in", "$$ne", "$$nin"
];

const valueToHydrate = z.string().regex(/^%%/);

const valueSchema: z.ZodType<Value> = z.union([
    valueToHydrate,
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
]);

const accessFilterOperatorsSchema = z.strictObject({ // Not strict as it's combined with documentSchema
    $eq: valueSchema,
    $in: valueSchema.array().or(valueToHydrate),
    $ne: valueSchema,
    $nin: valueSchema.array().or(valueToHydrate),
    $exists: z.boolean().or(valueToHydrate),
}).partial();

export type AccessFilter = {
    $and?: AccessFilter[],
    $nor?: AccessFilter[],
    $or?: AccessFilter[],
    
    $$eq?: [ Value, Value ],
    $$in?: [ Value, string | Value[] ],
    $$ne?: [ Value, Value ],
    $$nin?: [ Value, string | Value[] ]
} & {
    [prop: string]: Value | z.infer<typeof accessFilterOperatorsSchema> 
        | unknown[] // This is to support typecompletion for the root operator types 
}

export const accessFilterSchema: z.ZodType<AccessFilter> = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and () { return z.array(accessFilterSchema).min(1) },
        get $nor () { return z.array(accessFilterSchema).min(1) },
        get $or () { return z.array(accessFilterSchema).min(1) },

        $$eq: z.tuple([valueSchema, valueSchema]),
        $$in: z.tuple([valueSchema, z.union([valueToHydrate, valueSchema.array()])]),
        $$ne: z.tuple([valueSchema, valueSchema]),
        $$nin: z.tuple([valueSchema, z.union([valueToHydrate, valueSchema.array()])])
    }).partial().catchall(z.union([
        valueSchema,
        accessFilterOperatorsSchema
    ])).refine(
        (data) => Object.keys(data).every(key => !key.startsWith("$") || rootOperatorKeys.includes(key)),
        { message: "Invalid filter root operator" }
    )

