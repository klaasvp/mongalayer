import { z } from "zod";
import { documentSchema, documentValueSchema, JSONValue, SchemaPaths, Sort, sortSchema } from "./index.js";
import { filterOperatorsSchema } from "./query.js";
import { Get, Paths } from "type-fest";

type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

// Modifiers for the $push operator. $each holds the elements to append, while
// $slice, $sort & $position control how the array is trimmed, ordered and where the elements are inserted.
export type PushModifier<TValue, T> = {
    $each: readonly TValue[],
    $slice?: number,
    $position?: number,
    $sort?: 1 | -1 | Sort<T>
}

export type UpdateSchema<T extends any = unknown, TPaths extends SchemaPaths<T> = SchemaPaths<T>> = T extends object ? {
    $inc?: { [K in TPaths]?: number | undefined },
    $unset?: { [K in TPaths]?: "" | true | 1 },
    $set?: { [K in ExtendedPaths<TPaths>]?: Get<T, ReplaceArraySyntax<K>> }, 
    $push?: { [K in TPaths as Get<T, K> extends readonly any[] ? K : never]?: ArrayElement<Get<T, K>> | PushModifier<ArrayElement<Get<T, K>>, T> },
    $pull?: { [K in TPaths as Get<T, K> extends readonly any[] ? K : never]?: ArrayElement<Get<T, K>> | Record<string, JSONValue> | z.infer<typeof filterOperatorsSchema> }
} : {
    $inc?: Record<string, number | undefined>,
    $unset?: Record<string, "" | true | 1>,
    $set?: Record<string, JSONValue>,
    $push?: Record<string, JSONValue | PushModifier<JSONValue, T>>,
    $pull?: Record<string, JSONValue | z.infer<typeof filterOperatorsSchema>>
}

// $push modifier object. The strict object enforces that $slice, $sort & $position are only
// used together with $each, matching MongoDB's requirements.
export const pushModifierSchema = z.strictObject({
    $each: z.array(documentValueSchema),
    $position: z.number().int().optional(),
    $slice: z.number().int().optional(),
    $sort: z.union([z.literal(1), z.literal(-1), sortSchema]).optional()
});

export const updateSchema: z.ZodType<UpdateSchema> = 
    z.strictObject({
        $inc: z.record(z.string(), z.number().optional()),
        $unset: z.record(z.string(), z.union([z.literal(""), z.literal(true), z.literal(1)])),
        $set: documentSchema,
        // $push appends a single element to the array, or a modifier object ($each with optional $position, $sort & $slice)
        $push: z.record(z.string(), z.union([documentValueSchema, pushModifierSchema])),
        // $pull removes elements matching a value or a query condition
        $pull: z.record(z.string(), z.union([documentValueSchema, filterOperatorsSchema]))
    }).partial().refine((data) => Object.keys(data).length > 0, {
        message: "Update document requires at least one atomic operator"
    }) as unknown as z.ZodType<UpdateSchema>;

    
////////////////////////////////////////////////////////////////////
// Support for array updates with positional operator ($) in $set //
////////////////////////////////////////////////////////////////////

// A utility to replace all occurrences of ${number} (or actual numbers) with '$'
type ReplaceNumbersWithDollar<T extends string> = 
  // Matches a number in the middle of the path (e.g., "users.${number}.name" -> "users.$.name")
  T extends `${infer Left}.${number}.${infer Right}`
    ? ReplaceNumbersWithDollar<`${Left}.$.${Right}`>
  
  // Matches a number at the end of the path (e.g., "users.${number}" -> "users.$")
  : T extends `${infer Left}.${number}`
    ? `${Left}.$`
  
  // If no numbers are found, return the string as-is
  : T;

// A distributive wrapper that returns BOTH the original string and the transformed string
type ExtendedPaths<T> = T extends string ? T | ReplaceNumbersWithDollar<T> : T;

// The reverse utility to replace '$' back to '${number}' for the actual update operation
type ReplaceArraySyntax<T extends string> = T extends `${infer Left}.$${infer Right}` ? `${Left}.${number}${Right}` : T;