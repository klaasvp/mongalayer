import { MongoAPIError, MongoServerError } from "mongodb";
import { z } from "zod/v4";

export type MongoDBException = {
    code: number,
    codeName: string,
    message: string
};

export type MongoAPIException = {
    message: string
};

export type ZodException = {
    code: string,
    message: string
}

export const isMongoServerError = (e: any): e is MongoServerError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoServerError"
}; 

export const isMongoInvalidArgumentError = (e: any): e is MongoAPIError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoInvalidArgumentError";
}; 

export const isZodError = (e: any): e is z.ZodError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e instanceof z.ZodError;
}; 