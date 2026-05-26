# Mongalayer — MongoDB Access Layer

A type-safe abstraction layer between your MongoDB database and TypeScript clients. Define schemas with [Zod](https://zod.dev), control access through role-based definitions, and query your data with full type safety — from server to client.

Created as a **self-hosted replacement after MongoDB Atlas App Services deprecation**, specifically its Data Model / Data Access Permissions and the ability to query MongoDB collections from a client as you would in a Node.js environment.

## Features

- **Schema validation** using Zod to ensure data integrity
- **Role-based access control** at the document and field level
- **Full type safety** from server to client
- **Client SDK** with a familiar API that mirrors the server-side MongoDB driver

## Requirements

- **TypeScript** 5+ (recommended)
- **Zod** 4+
- **Node.js** 22+ (server)
- **MongoDB Node.js driver** 7+ (server)
- Any JavaScript runtime with `fetch` (client)

## Installation

### Server-side
#### Peer dependencies
```bash
npm install mongodb zod
```
#### Mongalayer package
```bash
npm install @mongalayer/server
```

### Client-side
```bash
npm install @mongalayer/client
```

## Project Structure

```
my-app/
├── model/                # Types & Zod schemas per collection
│   └── project.ts
├── server/
│   ├── access/           # Access definitions per collection
│   │   └── project.ts
│   ├── mongalayer.ts     # Mongalayer instance setup
│   └── index.ts          # Your HTTP server (Lambda, Express, etc.)
├── client/
│   └── index.ts          # Mongalayer client setup
└── package.json
```

## Quick Start

### 1. Define a Schema

```ts
// model/project.ts
import z from "zod";

export const projectSchema = z.strictObject({
    _id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    owner: z.string(),
    members: z.array(z.string()),
    createdAt: z.date()
});

export type Project = z.infer<typeof projectSchema>;
```

### 2. Define Access Rules

```ts
// server/access/project.ts
import { AccessPermissions, type AccessConfig } from "@mongalayer/server";
import type { Project } from "../../model/project.js";

export const projectAccess: AccessConfig<Project> = [{
    role: "owner",
    filter: {
        owner: "%%user.id"
    },
    document: AccessPermissions.ReadWrite,
    delete: true
}, {
    role: "member",
    filter: {
        members: { "$in": ["%%user.id"] }
    },
    document: AccessPermissions.Read
}];
```

The `%%` prefix injects values from the access payload at runtime (typically derived from a JWT or session).

### 3. Create the Mongalayer Instance

```ts
// server/mongalayer.ts
import { MongoClient } from "mongodb";
import { Mongalayer, AccessPermissions } from "@mongalayer/server";
import { projectSchema } from "../model/project.js";
import { projectAccess } from "./access/project.js";

const mongoClient = new MongoClient("mongodb://localhost:27017");

export const layer = new Mongalayer(mongoClient, {
    projects: {
        schema: projectSchema,
        access: projectAccess
    }
}, {
    accessDefaults: {
        document: AccessPermissions.None
    }
});
```

### 4. Expose Over HTTP

Mongalayer does not include its own HTTP server. Integrate it into your framework:

```ts
// server/index.ts (Express)
import express from "express";
import { layer } from "./mongalayer.js";
import { ServerError, validateAction } from "@mongalayer/server";

const app = express();
app.use(express.json());

app.post("/api/mongalayer", async (req, res) => {
    try {
        const user = await verifyToken(req.headers.authorization);
        validateAction(req.body.action);

        const result = await layer.executeRaw(
            req.body.action,
            req.body.payload,
            { user }
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ServerError) {
            res.status(400).json(error.toJSON());
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
    }
});

app.listen(3000);
```

### 5. Query From a Client

```ts
// client/index.ts
import { MongalayerClient } from "@mongalayer/client";
import type { Project } from "../model/project.js";

const client = new MongalayerClient("https://.../api/mongalayer", {
    format: "json",
    headers: () => ({
        "Authorization": `Bearer ${getToken()}`
    })
});

const db = client.db("myapp");
const projects = db.collection<Project>("projects");

// Find all projects the current user has access to
const result = await projects.find({});

// Insert a new project
await projects.insertOne({
    _id: crypto.randomUUID(),
    name: "My Project",
    owner: currentUserId,
    members: [],
    createdAt: new Date()
});

// Update a project
await projects.updateOne(
    { _id: "project-123" },
    { $set: { description: "Updated description" } }
);
```

## Packages

| Package | Description |
|---|---|
| `@mongalayer/server` | Core server library — schema validation, access control, MongoDB operations |
| `@mongalayer/client` | Lightweight HTTP client SDK for any `fetch`-compatible runtime |

## License

See [LICENSE](LICENSE) for details.
