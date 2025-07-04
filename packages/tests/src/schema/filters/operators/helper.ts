import { MongoServerError } from "mongodb";

export const isMongoServerError = (e: any): e is MongoServerError => {
    return Object.prototype.toString.call(e) === '[object Error]' && e.name === "MongoServerError"
}; 