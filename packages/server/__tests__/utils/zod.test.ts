import { describe, test, expect } from "vitest";
import z, { ZodBoolean, ZodDate, ZodLiteral, ZodNumber, ZodString } from "zod";
import { getSubschema } from "#src/utils/zod.js";

export const projectSchema = z.strictObject({
    _id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date().nullable(),
    version: z.number(),
    config: z.strictObject({
        tags: z.array(z.string())
    }),
    data: z.object({
        location: z.strictObject({
            coordinates: z.tuple([z.number(), z.number()]),
            city: z.preprocess((val) => val, z.string().default("Unknown City")),
            street: z.string().optional()
        }).optional()
    })
});

describe("schema/helper - getSubschema", () => {
	test("root-level fields", () => {
		const name = getSubschema(projectSchema, "name");
		expect(name?.schema).toBeInstanceOf(ZodString);

		const description = getSubschema(projectSchema, "description");
		expect(description?.schema).toBeInstanceOf(ZodString);
		expect(description?.meta.optional).toBe(true);

		const updatedAt = getSubschema(projectSchema, "updatedAt");
		expect(updatedAt?.schema).toBeInstanceOf(ZodDate);
        expect(updatedAt?.meta.nullable).toBe(true);
	});

	test("nested object fields", () => {
		const owners = getSubschema(projectSchema, "config.tags");
		expect(owners).toBeDefined();

		const street = getSubschema(projectSchema, "data.location.street");
		expect(street?.schema).toBeInstanceOf(ZodString);
		expect(street?.meta.optional).toBe(true);

		const city = getSubschema(projectSchema, "data.location.city");
		expect(city?.schema).toBeInstanceOf(ZodString);
		expect(city?.meta.pipe).toBe(true);
		expect(city?.meta.default).toBe("Unknown City");
	});

	test("array element access by index (tuple and array)", () => {
		const coord0 = getSubschema(projectSchema, "data.location.coordinates.0");
		expect(coord0?.schema).toBeDefined();

		const tag0 = getSubschema(projectSchema, "config.tags.0");
		expect(tag0).toBeDefined();
	});

	test("non-existent paths return undefined", () => {
		expect(getSubschema(projectSchema, "unknown")?.schema).toBeUndefined();
		expect(getSubschema(projectSchema, "config.unknown")?.schema).toBeUndefined();
		expect(getSubschema(projectSchema, "config.tags.name")?.schema).toBeUndefined();
		expect(getSubschema(projectSchema, "data.location.coordinates.x")?.schema).toBeUndefined();
	});
});


describe("schema/helper - getSubschema (custom schema)", () => {
	const custom = z.strictObject({
		opt: z.string().optional(),
		nul: z.string().nullable().default(null),
		arr: z.array(z.number()),
		tpl: z.tuple([z.string(), z.number()]).rest(z.boolean()),
		rec: z.record(z.string(), z.number()),
		map: z.map(z.string(), z.number()),
		set: z.set(z.number()),
		union: z.union([
			z.strictObject({ common: z.string(), onlyA: z.number().optional() }),
			z.strictObject({ common: z.string(), onlyB: z.boolean().optional() })
		]),
		dunion: z.discriminatedUnion("kind", [
			z.strictObject({ kind: z.literal("a"), a: z.string() }),
			z.strictObject({ kind: z.literal("b"), b: z.number() })
		]),
		ix: z.intersection(
			z.strictObject({ a: z.string() }),
			z.strictObject({ b: z.number() })
		),
		lazy: z.lazy(() => z.strictObject({ child: z.string() }))
	});

	test("optional and nullable metadata", () => {
		const opt = getSubschema(custom, "opt");
		expect(opt?.schema).toBeInstanceOf(ZodString);
		expect(opt?.meta.optional).toBe(true);

		const nul = getSubschema(custom, "nul");
		expect(nul?.schema).toBeInstanceOf(ZodString);
		expect(nul?.meta.nullable).toBe(true);
        expect(nul?.meta.default).toBe(null);
	});

	test("array, tuple and set access", () => {
		const arr0 = getSubschema(custom, "arr.0");
		expect(arr0?.schema).toBeInstanceOf(ZodNumber);

		const tpl0 = getSubschema(custom, "tpl.0");
		expect(tpl0?.schema).toBeInstanceOf(ZodString);

		const tpl1 = getSubschema(custom, "tpl.1");
		expect(tpl1?.schema).toBeInstanceOf(ZodNumber);

		const tpl2 = getSubschema(custom, "tpl.2"); // rest boolean
		expect(tpl2?.schema).toBeInstanceOf(ZodBoolean);

        const setValue = getSubschema(custom, "set.0");
        expect(setValue?.schema).toBeInstanceOf(ZodNumber);
	});

	test("record and map value types", () => {
		const recAny = getSubschema(custom, "rec.someKey");
		expect(recAny?.schema).toBeInstanceOf(ZodNumber);

		const mapAny = getSubschema(custom, "map.key");
		expect(mapAny?.schema).toBeInstanceOf(ZodNumber);
	});

	test("union common and branch-specific fields", () => {
		const common = getSubschema(custom, "union.common");
		expect(common?.schema).toBeInstanceOf(ZodString);

		const onlyA = getSubschema(custom, "union.onlyA");
		expect(onlyA?.schema).toBeInstanceOf(ZodNumber);

        const onlyB = getSubschema(custom, "union.onlyB");
		expect(onlyB?.schema).toBeInstanceOf(ZodBoolean);
	});

	test("discriminated union fields", () => {
		const kind = getSubschema(custom, "dunion.kind");
		expect(kind?.schema).toBeInstanceOf(ZodLiteral);

		const aField = getSubschema(custom, "dunion.a");
		expect(aField?.schema).toBeInstanceOf(ZodString);

        const bField = getSubschema(custom, "dunion.b");
        expect(bField?.schema).toBeInstanceOf(ZodNumber);
	});

	test("intersection fields from both sides", () => {
		const a = getSubschema(custom, "ix.a");
		expect(a?.schema).toBeInstanceOf(ZodString);

		const b = getSubschema(custom, "ix.b");
		expect(b?.schema).toBeInstanceOf(ZodNumber);
	});

	test("lazy resolution", () => {
		const child = getSubschema(custom, "lazy.child");
		expect(child?.schema).toBeInstanceOf(ZodString);
	});

	test("invalid paths return undefined", () => {
		expect(getSubschema(custom, "arr.x")?.schema).toBeUndefined();
		expect(getSubschema(custom, "tpl.foo")?.schema).toBeUndefined();
		expect(getSubschema(custom, "union.missing")?.schema).toBeUndefined();
		expect(getSubschema(custom, "dunion.missing")?.schema).toBeUndefined();
		expect(getSubschema(custom, "ix.missing")?.schema).toBeUndefined();
		expect(getSubschema(custom, "lazy.missing")?.schema).toBeUndefined();
	});
});