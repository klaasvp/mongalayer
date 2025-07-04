import z, { ZodType } from "zod/v4";
import { faker } from "@faker-js/faker";

export interface FilterTest { }

export const filterTestsSchema = z.object({

}) satisfies ZodType<FilterTest>;

export function getRandomFilterTest (): FilterTest {

    return {
        _id: faker.string.uuid(),
    };
}

export function getRandomFilterTests (count: number): FilterTest[] {
    return Array.from({ length: count }, () => getRandomFilterTest());
}