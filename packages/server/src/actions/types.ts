import { ZodError } from "zod/v4";

export class MongaLayerPayloadError extends Error {
    constructor(message: string) {
        super(message);

        this.name = "MongaLayerPayloadError";
    }
}

export class MongaLayerAccessError extends Error {
    constructor(message: string) {
        super(message);

        this.name = "MongaLayerAccessError";
    }
}