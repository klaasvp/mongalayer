import { faker } from "@faker-js/faker";
import z, { ZodType } from "zod/v4"
import { Project } from "./project.js";

export type ProjectAsset = {
    _id: string,
    projectID: string,
    type: "document" | "image" | "other",
    name: string,
    description?: string,
    createdAt: Date
};

const projectAssetTypes: ProjectAsset["type"][] = ["document", "image", "other"];

export const projectAssetSchema = z.strictObject({
    _id: z.string(),
    projectID: z.string(),
    type: z.enum(projectAssetTypes),
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.date()
}) satisfies ZodType<ProjectAsset>;

export function getRandomProjectAsset (projects: Project[]): ProjectAsset {
    const projectIds = projects.map(project => project._id);
    const randomProject = faker.helpers.arrayElement(projectIds);

    return {
        _id: faker.string.uuid(),
        projectID: randomProject,
        type: faker.helpers.arrayElement(projectAssetTypes),
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        createdAt: faker.date.past()
    };
}

export function getRandomProjectAssets (count: number, projects: Project[]): ProjectAsset[] {
    return Array.from({ length: count }, () => getRandomProjectAsset(projects));
}