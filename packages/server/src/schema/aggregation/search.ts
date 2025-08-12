import z from "zod/v4";
import { accumulatorsSchema, Expression, expressionSchema } from "../expression/index.js";

// For now we only support boost & constant
type ScoreOptions = {
    boost: { value: number } | { path: string, undefined?: number }
} | {
    constant: { value: number } 
} 

const scoreOptionsSchema = z.union([
    z.strictObject({
        boost: z.union([
            z.strictObject({ value: z.number() }),
            z.strictObject({
                path: z.string(),
                undefined: z.number().optional()
            })
        ])
    }),
    z.strictObject({
        constant: z.strictObject({ value: z.number() })
    })
]);

type SearchCompoundOperator = {
    score?: ScoreOptions
} & Record<"must" | "mustNot" | "should" | "filter", SearchOperator[]>;

const searchCompoundOperatorSchema: z.ZodType<SearchCompoundOperator> = z.strictObject({
    score: scoreOptionsSchema.optional()
}).and(z.record(z.enum(["must", "mustNot", "should", "filter"]), z.lazy(() => z.array(searchOperatorSchema))));

type SearchOperator = {
    compound: SearchCompoundOperator
} | {
    text: {
        query: string | string[],
        path: string | string[],
        fuzzy?: {
            maxEdits?: number,
            prefixLength?: number,
            maxExpansions?: number
        },
        matchCriteria?: "any" | "all",
        score?: ScoreOptions,
        synonyms?: string
    }
} | {
    autocomplete: {
        query: string | string[],
        path: string,
        fuzzy?: {
            maxEdits?: number,
            prefixLength?: number,
            maxExpansions?: number
        },
        tokenOrder?: "any" | "sequential",
        score?: ScoreOptions
    }
}

const searchOperatorSchema: z.ZodType<SearchOperator> = z.union([
    z.strictObject({ compound: searchCompoundOperatorSchema }),
    z.strictObject({ text: z.strictObject({
        query: z.string().or(z.array(z.string())),
        path: z.string().or(z.array(z.string())),
        fuzzy: z.strictObject({
            maxEdits: z.number().optional(),
            prefixLength: z.number().optional(),
            maxExpansions: z.number().optional()
        }).optional(),
        matchCriteria: z.enum([ "any", "all" ]).optional(),
        score: scoreOptionsSchema.optional(),
        synonyms: z.string().optional()
    })}),
    z.strictObject({ autocomplete: z.strictObject({
        query: z.string().or(z.array(z.string())),
        path: z.string(),
        fuzzy: z.strictObject({
            maxEdits: z.number().optional(),
            prefixLength: z.number().optional(),
            maxExpansions: z.number().optional()
        }).optional(),
        matchCriteria: z.enum([ "any", "sequential" ]).optional(),
        score: scoreOptionsSchema.optional(),
    })})
]);

export type Search = {
    index?: string
} & SearchOperator

// The aggregation projection only supports projecting other fields & string values in the projection expression
export const searchSchema: z.ZodType<Search> = z.strictObject({
    index: z.string().optional()
}).and(searchOperatorSchema);