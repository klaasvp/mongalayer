import { Collection, Document, Filter } from "mongodb";
import { AccessService } from "../access.js";

export type FindOnePayload<TSchema extends Document> = {
    filter: Filter<TSchema>,
    options?: {
        projection?: Document
    }
}

export default function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AccessService, payload: FindOnePayload<TSchema>): Promise<TSchema | null> {
    const filterWithAccess = accessService.getFilter(payload.filter as Filter<Document>);

    return collection.findOne(filterWithAccess, payload.options);
}