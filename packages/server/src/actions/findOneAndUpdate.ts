import { Collection, Document, Filter, FindOneAndUpdateOptions, ReturnDocument, WithId } from "mongodb";
import z from "zod/v4";
import { FilterSchema, filterSchema } from "../schema/query.js";
import { Projection, projectionSchema, Sort, sortSchema } from "../schema/index.js";
import { updateSchema, UpdateSchema } from "../schema/update.js";
import { UpdatableDocument, UpdateAccessService } from "../access/update.js";

export type FindOneAndUpdatePayload <TSchema extends Document> = {
    filter: FilterSchema,
    update: UpdateSchema,
    options?: { 
        projection?: Projection,
        upsert?: boolean,
        sort?: Sort,
        returnDocument?: typeof ReturnDocument[keyof typeof ReturnDocument]
    }
}

export type FindOneAndUpdateReturnType<TSchema extends Document> = null | TSchema | Partial<TSchema>;

const payloadSchema: z.ZodType<FindOneAndUpdatePayload<Document>> = z.object({
    filter: filterSchema,
    update: updateSchema,
    options: z.object({
        projection: projectionSchema.optional(),
        upsert: z.boolean().optional(),
        sort: sortSchema.optional(),
        returnDocument: z.enum(Object.values(ReturnDocument)).optional()
    }).optional()
});

export default async function <TSchema extends Document> (collection: Collection<TSchema>, accessService: UpdateAccessService, payload: FindOneAndUpdatePayload<TSchema>): Promise<FindOneAndUpdateReturnType<TSchema>> {
    payloadSchema.parse(payload);
    
    const stages = accessService.getStages(payload.filter as Filter<Document>);

    const pipeline: Document[] = [stages.$query];

    if (stages.$role) {
        pipeline.push(...stages.$role);
    }

    if (payload.options?.sort) {
        pipeline.push({ $sort: payload.options.sort });
    }

    pipeline.push({ $project: stages.$project }, {
        $limit: 1
    });
    
    const documentsWithRole = await collection.aggregate(pipeline).toArray() as UpdatableDocument[];
    const documentsToUpdate = await accessService.validateDocumentsAccess(documentsWithRole, payload.update, true);

    const { returnDocument, projection } = payload.options ?? {};
    
    let filter: Filter<Document>, update: Document, options: FindOneAndUpdateOptions, role: string | null | undefined; 

    if (documentsToUpdate.length === 0) {
        // If upsert is true and now matching documents were found, validate & upsert the document
        if (payload.options?.upsert === true) {
            const { doc: insertableDoc, role: insertableRole } = await accessService.getUpsertDocument(payload.filter, payload.update);

            filter = { _id: insertableDoc._id } as Filter<Document>;
            update = { $set: insertableDoc } as Document;
            options = { upsert: true, returnDocument, projection };
            role = insertableRole?.role ?? null;
        } 
        // If no matching documents were found directly return
        else {
            return null;
        }
    } else {
        accessService.validateUpdateFields(payload.update);

        filter = { _id: documentsToUpdate[0] } as Filter<Document>;
        update = payload.update as Document;
        options = { returnDocument, projection };
        role = documentsWithRole[0].__mongalayer_role;
    }

    const result = await collection.findOneAndUpdate(filter, update, options);

    if (result === null) return null;

    return accessService.processFields([{ ...result, __mongalayer_role: role }] as TSchema[], payload.options?.projection)[0];
}