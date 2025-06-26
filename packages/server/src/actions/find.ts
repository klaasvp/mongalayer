import { Collection, Document, Filter } from "mongodb";
import { AccessService } from "../access.js";

export type FindPayload <TSchema extends Document> = {
    filter: Filter<TSchema>,
    options?: {
        projection?: Document
    }
}

export default function <TSchema extends Document> (collection: Collection<TSchema>, accessService: AccessService, payload: FindPayload<TSchema>): Promise<TSchema[]> {
    const filterWithAccess = accessService.getFilter(payload.filter as Filter<Document>);

    return collection.find(filterWithAccess, payload.options).toArray() as Promise<TSchema[]>;
}