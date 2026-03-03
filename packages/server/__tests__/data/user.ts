import { faker } from "@faker-js/faker";
import z, { ZodType } from "zod"

export enum UserRoles {
    ADMIN = "admin",
    USER = "user"
};

export interface User {
    _id: string,
    name: string,
    email: string,
    roles: UserRoles[],
    createdAt: Date,
    updatedAt: Date,
    settings: {
        theme: "light" | "dark"
    }
}

export const userSchema = z.object({
    _id: z.string(),
    name: z.string(),
    email: z.string(),
    roles: z.array(z.enum([UserRoles.ADMIN, UserRoles.USER])),
    createdAt: z.date(),
    updatedAt: z.date(),
    settings: z.object({
        theme: z.enum(["light", "dark"])
    })
}) satisfies ZodType<User>;

export function getRandomUser (): User {
    return {
        _id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        roles: faker.helpers.arrayElements([UserRoles.ADMIN, UserRoles.USER]),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        settings: {
            theme: faker.helpers.arrayElement(["light", "dark"])
        }
    };
}

export function getRandomUsers (count: number): User[] {
    return Array.from({ length: count }, () => getRandomUser())
}