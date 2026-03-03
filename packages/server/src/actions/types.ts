import { ZodError } from "zod";

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