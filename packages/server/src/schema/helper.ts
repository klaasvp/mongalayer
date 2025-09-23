import z, { ZodArray, ZodDefault, ZodDiscriminatedUnion, ZodIntersection, ZodMap, ZodNullable, ZodObject, ZodOptional, ZodRecord, ZodSet, ZodTuple, ZodType, ZodUnion } from "zod/v4";

export function deepPartial(schema: any): any {
    // Unwrap wrappers while preserving optional/nullable at the wrapper level
    if (schema instanceof ZodOptional) {
        return z.optional(deepPartial(schema.unwrap()));
    }
    
    if (schema instanceof ZodNullable) {
        return z.nullable(deepPartial(schema.unwrap()));
    }

    if (schema instanceof ZodDefault) {
        // Remove default to avoid injecting values during partial validation
        return deepPartial(schema.unwrap());
    }

    // Structured types
    if (schema instanceof ZodObject) {
        const newShape: Record<string, any> = {};
        for (const [key, value] of Object.entries(schema.shape)) {
            newShape[key] = deepPartial(value).optional();
        }
        // Preserve unknownKeys policy by creating a new object and merging catchall if present
        const partial = z.object(newShape as any);
        const catchall = schema.def.catchall;
        return catchall ? (partial.catchall(deepPartial(catchall))) : partial;
    }

    if (schema instanceof ZodArray) {
        return z.array(deepPartial(schema.element));
    }

    if (schema instanceof ZodRecord) {
        const keySchema = schema.keyType ?? z.string();
        const valueType = schema.valueType;
        return z.record(keySchema, deepPartial(valueType));
    }

    if (schema instanceof ZodTuple) {
        const items = schema.def.items;
        const itemsPartial = items.map((i: any) => deepPartial(i));
        const base: any = z.tuple(itemsPartial as any);
        const rest = schema.def.rest;
        return rest ? base.rest(deepPartial(rest)) : base;
    }

    if (schema instanceof ZodUnion) {
        const options = schema.options;
        return z.union(options.map((o: any) => deepPartial(o)) as any);
    }

    if (schema instanceof ZodDiscriminatedUnion) {
        const disc = schema._zod.def.discriminator;
        const options = Array.from(schema.options.values()).map((o) => deepPartial(o) as z.ZodTypeAny);
        return z.discriminatedUnion(disc, options as any);
    }

    if (schema instanceof ZodIntersection) {
        const left = schema.def.left;
        const right = schema.def.right;
        return z.intersection(deepPartial(left), deepPartial(right));
    }

    if (schema instanceof ZodMap) {
        const key = schema.keyType ?? schema.def.keyType;
        const value = schema.valueType ?? schema.def.valueType;
        return z.map(key, deepPartial(value));
    }

    if (schema instanceof ZodSet) {
        const value = schema.def.valueType;
        return z.set(deepPartial(value));
    }

    // Other leaf types (string, number, enum, literal, etc.) are left as-is
    return schema;
}