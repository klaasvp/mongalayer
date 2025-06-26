import { faker } from "@faker-js/faker";
import z, { ZodType } from "zod/v4"
import { User } from "./user.js";

export type ProjectAccess = {
    owners: string[],
    contributors: string[],
    readers: string[]
}

export type Project = {
    _id: string,
    name: string,
    description: string,
    access: ProjectAccess,
    createdAt: Date,
    updatedAt: Date
};

export const projectSchema = z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string(),
    access: z.object({
        owners: z.array(z.string()),
        contributors: z.array(z.string()),
        readers: z.array(z.string())
    }),
    createdAt: z.date(),
    updatedAt: z.date()
}) satisfies ZodType<Project>;

export function getRandomProject (users: User[]): Project {
    const userIds = users.map(user => user._id);
    const 
        randomOwners = faker.helpers.arrayElements(userIds, 2),
        randomContributors = faker.helpers.arrayElements(userIds, 2),
        randomReaders = faker.helpers.arrayElements(userIds, 2);

    return {
        _id: faker.string.uuid(),
        name: faker.company.name(),
        description: faker.company.catchPhrase(),
        access: {
            owners: randomOwners,
            contributors: randomContributors.filter(id => !randomOwners.includes(id)),
            readers: randomReaders.filter(id => !randomOwners.includes(id) && !randomContributors.includes(id))
        },
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
    };
}

export function getRandomProjects (count: number, users: User[]): Project[] {
    return Array.from({ length: count }, () => getRandomProject(users));
}