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
    updatedAt: Date,
    config: {
        secret: string,
        tags: string[]
    },
    data: {
        location: {
            coordinates: [number, number],
            city: string,
            street: string
        }
    }
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
    updatedAt: z.date(),
    config: z.object({
        secret: z.string(),
        tags: z.array(z.string())
    }),
    data: z.object({
        location: z.object({
            coordinates: z.tuple([z.number(), z.number()]),
            city: z.string(),
            street: z.string()
        })   
    })
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
        updatedAt: faker.date.recent(),
        config: {
            secret: faker.string.alphanumeric(10),
            tags: faker.helpers.arrayElements(["tag1", "tag2", "tag3"], 2)
        },
        data: {
            location: {
                coordinates: [faker.location.latitude(), faker.location.longitude()],
                city: faker.location.city(),
                street: faker.location.street()
            }
        }
    };
}

export function getRandomProjects (count: number, users: User[]): Project[] {
    return Array.from({ length: count }, () => getRandomProject(users));
}