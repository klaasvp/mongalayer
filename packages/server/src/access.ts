import { Filter, Document } from "mongodb";
import { iteratePrimitives } from "./utils/replacer.js";
import { ZodObject } from "zod/v4";

export const AccessFieldPermissions = {
    /**
     * Note: This does not exclude the _id field. If you want to exclude the _id field, you need to add it to the fields object.
     */
    None: "x",
    Read: "r",
    Create: "c",
    Write: "w"
} as const;

export type AccessFieldPermissionsType = typeof AccessFieldPermissions;
export type AccessFieldPermission = AccessFieldPermissionsType[keyof AccessFieldPermissionsType];

/**
 * Fields access only supports defining root level properties from the Document.
 */
export type AccessDefinition<TSchema extends Document = Document> = {
    role: string,
    filter?: Document,
    fields?: Partial<Record<keyof TSchema, AccessFieldPermission>>,
    fieldsDefault?: AccessFieldPermission,
    delete?: boolean
};

export type AccessConfig<TSchema extends Document = Document> = AccessDefinition<TSchema>[];

export type AccessPayload = Record<string, any>;

export type WithAccessRole<TSchema extends Document> = TSchema & { __mongalayer_role: string | null };