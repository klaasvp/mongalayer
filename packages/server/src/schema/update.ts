import { z } from "zod";
import { documentSchema, documentValueSchema, JSONValue } from "./index.js";
import { filterOperatorsSchema } from "./query.js";
import { Get, Paths } from "type-fest";

type SchemaPaths<T> = T extends object ? `${Paths<T, { maxRecursionDepth: 10 }>}` : never;

type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

export type UpdateSchema<T extends any = unknown, TPaths extends SchemaPaths<T> = SchemaPaths<T>> = T extends object ? {
    $inc?: { [K in TPaths]?: number | undefined },
    $unset?: { [K in TPaths]?: "" | true | 1 },
    $set?: { [K in ExtendedPaths<TPaths>]?: Get<T, ReplaceArraySyntax<K>> }, 
    $push?: { [K in TPaths as Get<T, K> extends readonly any[] ? K : never]?: ArrayElement<Get<T, K>> },
    $pull?: { [K in TPaths as Get<T, K> extends readonly any[] ? K : never]?: ArrayElement<Get<T, K>> | Record<string, JSONValue> | z.infer<typeof filterOperatorsSchema> }
} : {
    $inc?: Record<string, number | undefined>,
    $unset?: Record<string, "" | true | 1>,
    $set?: Record<string, JSONValue>,
    $push?: Record<string, JSONValue>,
    $pull?: Record<string, JSONValue | z.infer<typeof filterOperatorsSchema>>
}

export const updateSchema: z.ZodType<UpdateSchema> = 
    z.strictObject({
        $inc: z.record(z.string(), z.number().optional()),
        $unset: z.record(z.string(), z.union([z.literal(""), z.literal(true), z.literal(1)])),
        $set: documentSchema,
        // $push without modifiers ($each, $position, $sort, $slice) appends a single element to the array
        $push: z.record(z.string(), documentValueSchema),
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