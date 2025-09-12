import { Filter, Document, OptionalUnlessRequiredId } from "mongodb";
import { AccessService } from "../access.js";
import z from "zod/v4";

export type InsertableDocument<TSchema extends Document> = OptionalUnlessRequiredId<TSchema>;

export class InsertAccessService extends AccessService {
    public getStages(): Record<string, any> {
        throw "N/A";
    }

    public validateDocuments (docs: InsertableDocument<Document>[]) {
        return z.array(this.documentSchema).parse(docs);
    }

    public validateDocumentsAccess (docs: InsertableDocument<Document>[]) {
        throw "Unauthorized";
    }
}