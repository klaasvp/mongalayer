import { faker } from "@faker-js/faker";
import z, { ZodType } from "zod/v4"
import { Project, projectAssetUnfinishedStatus } from "./project.js";

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
    const assetID = faker.string.uuid();

    const projectIds = projects.map(project => project._id);

    const 
        randomProjectID = faker.helpers.arrayElement(projectIds),
        randomProject = projects.find(({ _id }) => randomProjectID === _id)!;

    if (randomProject.latestAssets.length === 0 || Math.random() < 0.1) { // At least 1 else a 10% chance
        randomProject.latestAssets.push(assetID);
    } else if (randomProject.unfinishedAssets.length === 0 || Math.random() < 0.2) {
        randomProject.unfinishedAssets.push({
            id: assetID,
            status: faker.helpers.arrayElement(projectAssetUnfinishedStatus)
        });
    }

    return {
        _id: assetID,
        projectID: randomProjectID,
        type: faker.helpers.arrayElement(projectAssetTypes),
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        createdAt: faker.date.past()
    };
}

export function getRandomProjectAssets (count: number, projects: Project[]): ProjectAsset[] {
    return Array.from({ length: count }, () => getRandomProjectAsset(projects));
}