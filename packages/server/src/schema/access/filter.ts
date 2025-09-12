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

export type AccessFilterFixedKeys = {
    $and: AccessFilter[],
    $nor: AccessFilter[],
    $or: AccessFilter[],

    $$eq: [ Value, Value ],
    $$in: [ Value, string | Value[] ],
    $$ne: [ Value, Value ],
    $$nin: [ Value, string | Value[] ]
};

export type AccessFilter = Partial<AccessFilterFixedKeys> & {
    [K in string as Exclude<K, keyof AccessFilterFixedKeys>]?: Value | z.infer<typeof accessFilterOperatorsSchema>
}

export const accessFilterSchemaArray: z.ZodType<AccessFilter[]> = z.lazy(() => z.array(accessFilterSchema).min(1));
export const accessFilterSchema = 
    // Not strict as it's combined with documentSchema which is Record<string, ...>
    z.object({
        get $and () { return accessFilterSchemaArray },
        get $nor () { return accessFilterSchemaArray },
        get $or () { return accessFilterSchemaArray },

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