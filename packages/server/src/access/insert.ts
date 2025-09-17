import { Filter, Document, OptionalUnlessRequiredId } from "mongodb";
import { AccessDefinition, AccessService } from "../access.js";
import z from "zod/v4";
import { matches } from "./matcher.js";

export type InsertableDocument<TSchema extends Document> = OptionalUnlessRequiredId<TSchema>;

export class InsertAccessService extends AccessService {
    public getStages(): Record<string, any> {
        throw "N/A";
    }

    public validateDocuments (docs: InsertableDocument<Document>[]) {
        return z.array(this.documentSchema).parse(docs);
    }

    public validateDocumentsAccess (docs: InsertableDocument<Document>[]) {
        for (const doc of docs) {
            const accessRole = this.getAccessRole(doc);

            if (this.hydratedConfig.length > 0) {
                if (accessRole === null) throw "No access role found for document";
                
                const hasInsertPermission = accessRole.create === true || this.accessDefaults.create === true;

                if (!hasInsertPermission) throw "No create access for document";

                // TODO check individual field permissions
            } else if (this.accessDefaults.create !== true) {
                throw "No (default) create access for document";
            }
        }
    }

    private getAccessRole (doc: InsertableDocument<Document>): AccessDefinition | null {
        for (const accessDef of this.hydratedRawConfig) {
            // Get the first matching role
            if (matches(doc, accessDef.filter ?? {})) {
                return accessDef;
            }
        }

        return null;
    }
}