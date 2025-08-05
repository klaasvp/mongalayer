import z from "zod"

const inputWithNSchema = z.lazy(() => z.strictObject({ input: expressionSchema, n: expressionSchema }))

export type First = { $first: Expression }
export const $first: z.ZodType<First> = z.strictObject({ get $first () { return lazyExpressionSchema } })

export type FirstN = { $firstN: { input: Expression, n: Expression } }
export const $firstN: z.ZodType<FirstN> = z.strictObject({ get $firstN () { return inputWithNSchema } })

export type Last = { $last: Expression }
export const $last: z.ZodType<Last> = z.strictObject({ get $last () { return lazyExpressionSchema } })

export type LastN = { $lastN: { input: Expression, n: Expression } }
export const $lastN: z.ZodType<LastN> = z.strictObject({ get $lastN () { return inputWithNSchema } })

export type ExpressionOperator = {
    $avg: Expression | Expression[]
} | {
    $max: Expression | Expression[]
} | {
    $median: { input: Expression[], method: "approximate" }
} | {
    $min: Expression | Expression[]
} | {
    $sum: Expression[]
} | First | FirstN | Last | LastN

export type Expression = string | ExpressionOperator;

/*export type ExpressionReturnType = z.ZodType<Expression>
export type ExpressionWithArrayReturnType = z.ZodType<Expression | Expression[]>*/

export const operatorSchema: z.ZodType<ExpressionOperator> = z.union([
    z.strictObject({
        get $avg () { return lazyExpressionSchemaWithArray }
    }),
    $first,
    $firstN,
    $last,
    $lastN,
    z.strictObject({
        get $max () { return lazyExpressionSchemaWithArray }
    }),
    z.strictObject({
        get $median () { return z.lazy(() => z.strictObject({ input: expressionSchema.array(), method: z.literal("approximate") })) }
    }),
    z.strictObject({
        get $min () { return lazyExpressionSchemaWithArray }
    }),
    z.strictObject({
        get $sum () { return lazyExpressionSchemaArray }
    })
])

// For now we'll only support paths ($...) as expressions next to the operators
export const expressionSchema: z.ZodType<Expression> = operatorSchema.or(z.string().regex(/^\$/));

const lazyExpressionSchema = z.lazy(() => expressionSchema);
const lazyExpressionSchemaArray = z.lazy(() => expressionSchema.array());
const lazyExpressionSchemaWithArray = z.lazy(() => expressionSchema.or(expressionSchema.array()));