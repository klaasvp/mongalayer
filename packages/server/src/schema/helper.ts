import z, { ZodArray, ZodDefault, ZodDiscriminatedUnion, ZodIntersection, ZodLazy, ZodMap, ZodNever, ZodNullable, ZodObject, ZodOptional, ZodRecord, ZodSet, ZodTuple, ZodUnion } from "zod/v4";

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

    if (schema instanceof ZodLazy) {
        return z.lazy(() => deepPartial(schema.def.getter()));
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

type ZodTypeUnknown = z.core.$ZodType<unknown>;
type ZodSchemaMeta = {
    optional: boolean,
    nullable: boolean,
    default?: any
};

function unwrap (schema: ZodTypeUnknown): { schema: ZodTypeUnknown, meta: ZodSchemaMeta } {
    const meta: ZodSchemaMeta = {
        optional: false,
        nullable: false
    }

    // Unwrap optional/nullable/default/effects wrappers
    while (
        schema instanceof ZodOptional ||
        schema instanceof ZodNullable ||
        schema instanceof ZodDefault
    ) {
        // Handle different wrapper types
        if (schema instanceof ZodOptional || schema instanceof ZodNullable || schema instanceof ZodDefault) {
            if (schema instanceof ZodOptional) meta.optional = true;
            if (schema instanceof ZodNullable) meta.nullable = true;
            if (schema instanceof ZodDefault) meta.default = schema.def.defaultValue;

            // Unwrap to inner schema
            schema = schema.unwrap();
        }
    }

    return { schema, meta };
}

/**
 * Extracts a nested subschema from a Zod schema using MongoDB dot notation
 * 
 * @param schema The parent Zod schema
 * @param path MongoDB dot notation path (e.g., "user.address.city")
 * @returns The subschema at the specified path or undefined if not found
 */
export function getSubschema(sourceSchema: ZodTypeUnknown, path: string ): { schema: ZodTypeUnknown, meta: ZodSchemaMeta } | undefined;
export function getSubschema(sourceSchema: ZodTypeUnknown, path: string, unwrapSchema: false ): { schema: ZodTypeUnknown } | undefined;
export function getSubschema(sourceSchema: ZodTypeUnknown, path: string, unwrapSchema: true ): { schema: ZodTypeUnknown, meta: ZodSchemaMeta } | undefined;
export function getSubschema(sourceSchema: ZodTypeUnknown, path: string, unwrapSchema: boolean = true ) {
    const segments = path.split(".");

    const { schema } = unwrapSchema ? unwrap(sourceSchema) : { schema: sourceSchema };

    let current: ZodTypeUnknown = schema;

    for (let i=0, il=segments.length; i < il; i++) {
        if (current instanceof ZodLazy) {
            current = current.def.getter();
        }

        const segment = segments[i];
        
        // Handle numeric array indices
        const isArrayIndex = !isNaN(Number(segment));
        
        // Navigate based on schema type
       if (current instanceof ZodObject) {
            // Object property access
            if (!(segment in current.shape)) {
                // Check for catchall if property doesn't exist
                if (current.def.catchall) {
                    current = current.def.catchall;
                    
                    // Probably means the object is Strict and the property doesn't exist
                    if (current instanceof ZodNever) {
                        return undefined;
                    }
                } else {
                    return undefined;
                }
            } else {
                current = current.shape[segment];
            }
        } else if (current instanceof ZodArray) {
            // Array element access (ignores specific index)
            if (isArrayIndex) {
                current = current.element;
            } else {
                return undefined;
            }
        } else if (current instanceof ZodTuple) {
            // Tuple element access by index
            if (isArrayIndex) {
                const index = Number(segment);

                if (index < current.def.items.length) {
                    current = current.def.items[index];
                } else if (current.def.rest) {
                    current = current.def.rest;
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        } else if (current instanceof ZodRecord) {
            // Record value type (key doesn't matter)
            current = current.valueType;
        } else if (current instanceof ZodMap) {
            // Map value type
            current = current.def.valueType;
        } else if (current instanceof ZodSet) {
            // Set value type
            current = current.def.valueType;
        } else if (current instanceof ZodUnion || current instanceof ZodDiscriminatedUnion) {
            // For unions, we need to check all options
            // Return the first option that has the path
            // This is a simplification - in practice, you might want more complex logic
            const options = current.def.options || [...current.options];
            let found = false;
            // Try to find an option that has this path
            for (const option of options) {
                const subOption = getSubschema(option, segments.slice(i).join("."), false);
                if (subOption?.schema) {
                    current = subOption.schema;
                    found = true;
                    break;
                }
            }
            
            if (found === false) return undefined;
        } else if (current instanceof ZodIntersection) {
            // Try left side first, then right
            const leftResult = getSubschema(current.def.left, segments.slice(i).join("."), false);

            if (leftResult?.schema) {
                current = leftResult.schema;
            } else {
                const rightResult = getSubschema(current.def.right, segments.slice(i).join("."), false);

                if (rightResult?.schema) {
                    current = rightResult.schema;
                } else {
                    return undefined;
                }
            }
        } else {
            // Any other type can't be descended into
            return undefined;
        }
    }

    return unwrapSchema ? unwrap(current) : { schema: current };
}