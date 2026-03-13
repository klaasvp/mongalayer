import z from "zod";

// For now we only support boost & constant
type ScoreOptions = {
    boost: { value: number } | { path: string, undefined?: number }
} | {
    constant: { value: number } 
} 

const scoreOptionsSchema = z.union([
    z.object({
        boost: z.union([
            z.object({ value: z.number() }),
            z.object({
                path: z.string(),
                undefined: z.number().optional()
            })
        ])
    }),
    z.object({
        constant: z.strictObject({ value: z.number() })
    })
]);

type SearchCompoundOperator = {
    score?: ScoreOptions,
    must?: SearchOperator[],
    mustNot?: SearchOperator[],
    should?: SearchOperator[],
    filter?: SearchOperator[],
};

const searchCompoundOperatorSchema: z.ZodType<SearchCompoundOperator> = z.strictObject({
    score: scoreOptionsSchema.optional(),
    must: z.lazy(() => z.array(searchOperatorSchema).min(1)).optional(),
    mustNot: z.lazy(() => z.array(searchOperatorSchema).min(1)).optional(),
    should: z.lazy(() => z.array(searchOperatorSchema).min(1)).optional(),
    filter: z.lazy(() => z.array(searchOperatorSchema).min(1)).optional()
});

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
    z.object({ compound: searchCompoundOperatorSchema }),
    z.object({ text: z.strictObject({
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
    z.object({ autocomplete: z.strictObject({
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
export const searchSchema: z.ZodType<Search> = z.object({
    index: z.string().optional()
}).and(searchOperatorSchema);