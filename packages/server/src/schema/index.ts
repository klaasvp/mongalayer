import { z } from "zod";
import { iteratePrimitives } from "@mongalayer/core";
import { Get, Paths } from "type-fest";
import { Document } from "mongodb";

type MaybeArrayElement<T> = T extends readonly (infer E)[] ? E : T;

export type SchemaPaths<T> = T extends object ? `${Paths<T, { maxRecursionDepth: 10 }>}` : never;

// A utility to remove all occurrences of ${number} (or actual numbers) to support nested dot notation for arrays in filters
type StripArrayNumber<T extends string> = 
    // Matches a number in the middle of the path (e.g., "users.${number}.name" -> "users.name")
    T extends `${infer Left}.${number}.${infer Right}`
        ? StripArrayNumber<`${Left}.${Right}`>  
        // If no numbers are found, return the string as-is
        : T;

// A distributive wrapper that returns BOTH the original string and the transformed string
type ExtendedPaths<T> = T extends string ? T | StripArrayNumber<T> : T;

// The inverse of StripArrayNumber: rebuilds a stripped path by re-inserting `${number}` for every
// segment of T that is an array, so the path can be resolved against T again (e.g. with Get).
// Already-indexed segments are preserved, so it is safe to apply to both stripped and original paths.
type RebuildArrayPath<T, P extends string> =
    T extends readonly (infer E)[]
        // Current segment is an array: consume an existing index or re-insert `${number}`, then recurse into the element
        ? P extends `${number}.${infer Rest}`
            ? `${number}.${RebuildArrayPath<E, Rest>}`
            : P extends `${number}`
                ? P
                : `${number}.${RebuildArrayPath<E, P>}`
            : P extends `${infer Head}.${infer Rest}`
        ? Head extends keyof T
            ? `${Head}.${RebuildArrayPath<T[Head], Rest>}`
            : P
        : P;

export type DotNotationPaths<T extends any = unknown> = T extends Document ? `${ExtendedPaths<Paths<T, { maxRecursionDepth: 10 }>>}` : never;

export type FieldsWithValue<T extends any = unknown, ExtraValues extends any = never> = {
    [K in DotNotationPaths<T>]?: Get<T, RebuildArrayPath<T, K>> | ExtraValues
}

export type FieldsWithCustomValue<T extends any = unknown, CustomValue extends any = unknown> = {
    [K in DotNotationPaths<T>]?: CustomValue
}

type ProjectionValue = 0 | 1 | boolean;

export type Projection<T extends any = unknown> = T extends Document ? FieldsWithCustomValue<T, ProjectionValue | Projection> : { [key: string]: ProjectionValue | Projection };

// MongoDB also support certain operators for projection, we don't support that yet.
export const projectionSchema = z.lazy(() => z.record(z.string(), z.union([z.literal(0), z.literal(1), z.boolean(), projectionSchema]))).check((ctx) => {
    let firstProjectionType: 0 | 1 | undefined = undefined;
    
    iteratePrimitives(ctx.value, (key, value, replace) => {
        if (key !== "_id") {
            const newValue = !!value ? 1 : 0

            if (firstProjectionType === undefined) {
                firstProjectionType = newValue;
            } else if (firstProjectionType !== newValue) {
                ctx.issues.push({
                    code: "invalid_value",
                    message: "Projection cannot mix inclusion and exclusion.",
                    input: ctx.value,
                    values: []
                });
            }
        }
    });
}) as z.ZodType<Projection>

export type Sort<T extends any = unknown> = T extends Document ? FieldsWithCustomValue<T, -1 | 1> : { [x: string]: -1 | 1 };

export const sortSchema = z.record(z.string(), z.union([z.literal(-1), z.literal(1)])) as z.ZodType<Sort>

export const keyWithoutDollar = z.string().regex(/^[^\$]/);

export type JSONValue = string | number | boolean | null | Date | { [key: string]: JSONValue } | JSONValue[];

export const documentValueSchema: z.ZodType<JSONValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.date(),
    //z.undefined() -> JSON which will be the payload does not support undefined,
    z.array(documentValueSchema),
    z.record(keyWithoutDollar, documentValueSchema)
]))

export const documentSchema = z.record(keyWithoutDollar, documentValueSchema);