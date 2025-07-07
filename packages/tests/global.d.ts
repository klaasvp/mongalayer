import { MongoClient } from "mongodb";
import { User } from "./data/user.ts";
import { Project } from "./data/project.ts";
import { MongoMemoryServer } from "mongodb-memory-server";

export {}

declare global {
    var __MONGO_URI__: string;

    var $md: MongoMemoryServer;

    var $mdb: {
        client: MongoClient,
        name: string,
        objects: {
            users: User[],
            projects: Project[],
            filterTests: FilterTest[]
        }
    }
}