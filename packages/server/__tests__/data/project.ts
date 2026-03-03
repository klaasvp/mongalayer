import { faker } from "@faker-js/faker";
import z, { ZodType } from "zod"
import { User } from "./user.js";
import { ProjectAsset } from "./projectAsset.js";

export type ProjectAccess = {
    owners: string[],
    contributors: string[],
    readers: string[]
}

export type UnfinishProjectAssets = {
    id: ProjectAsset["_id"],
    status: "design" | "testing" | "production"
}

export type Project = {
    _id: string,
    type: "lite" | "standard" | "premium" | "custom",
    name: string,
    description?: string,
    access: ProjectAccess,
    createdAt: Date,
    updatedAt: Date | null,
    version: number,
    config: {
        secret: string,
        tags: string[]
    },
    data: {
        location?: {
            coordinates: [number, number],
            city: string,
            street?: string
        }
    },
    latestAssets: ProjectAsset["_id"][],
    unfinishedAssets: UnfinishProjectAssets[]
};

const projectTypes: Project["type"][] = ["lite", "standard", "premium", "custom"];

export const projectAssetUnfinishedStatus: UnfinishProjectAssets["status"][] = ["design", "testing", "production"]

export const projectSchema = z.strictObject({
    _id: z.string(),
    type: z.enum(projectTypes),
    name: z.string(),
    description: z.string().optional(),
    access: z.strictObject({
        owners: z.array(z.string()),
        contributors: z.array(z.string()),
        readers: z.array(z.string())
    }),
    createdAt: z.date(),
    updatedAt: z.date().nullable(),
    version: z.number(),
    config: z.strictObject({
        secret: z.string(),
        tags: z.array(z.string())
    }),
    data: z.object({
        location: z.strictObject({
            coordinates: z.tuple([z.number(), z.number()]),
            city: z.preprocess((val) => val, z.string().default("Unknown City")),
            street: z.string().optional()
        }).optional()
    }),
    latestAssets: z.array(z.string()),
    unfinishedAssets: z.array(z.strictObject({
        id: z.string(),
        status: z.enum(projectAssetUnfinishedStatus)
    }))
}) satisfies ZodType<Project>;

export function getRandomProject (users: User[]): Project {
    const userIds = users.map(user => user._id);
    const 
        randomOwners = faker.helpers.arrayElements(userIds, 2),
        randomContributors = faker.helpers.arrayElements(userIds.filter(id => !randomOwners.includes(id)), 2),
        randomReaders = faker.helpers.arrayElements(userIds.filter(id => !randomOwners.includes(id) && !randomContributors.includes(id)), 2);

    return {
        _id: faker.string.uuid(),
        type: faker.helpers.arrayElement(projectTypes.slice(0, 3)), // Exclude "custom" for random projects
        name: faker.company.name(),
        description: faker.company.catchPhrase(),
        access: {
            owners: randomOwners,
            contributors: randomContributors,
            readers: randomReaders
        },
        createdAt: faker.date.past(),
        updatedAt: faker.helpers.arrayElement([faker.date.recent(), null]),
        version: faker.number.int({ min: 0, max: 1_000 }),
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
        },
        latestAssets: [],
        unfinishedAssets: []
    };
}

export function getRandomProjects (count: number, users: User[]): Project[] {
    return Array.from({ length: count }, () => getRandomProject(users));
}