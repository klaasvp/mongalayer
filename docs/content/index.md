---
seo:
  title: Mongalayer - MongoDB Access Layer for TypeScript
  description: A type-safe abstraction layer between your MongoDB database and TypeScript clients, with role-based access control and schema validation.
---

::u-page-hero{class="dark:bg-gradient-to-b from-neutral-900 to-neutral-950"}
---
orientation: horizontal
---
#title
MongoDB [Access]{.text-primary} Layer.

#description
Mongalayer is a type-safe abstraction layer between your MongoDB database and TypeScript clients, designed for basic [CRUD]{.text-primary} applications. Define schemas with [Zod]{.text-primary}, control access through role-based definitions, and query your data with full type safety — from server to client.

#links
  :::u-button
  ---
  to: /getting-started
  size: xl
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

#default
:::code-group

```vue [app.vue]
<script setup lang="ts">
import { Project } from "model/project";

const { $database } = useNuxtApp();

const allProjects: Ref<Project[]> = ref([]);

onMounted(async () => {
    allProjects.value = await $database.collection<Project>("projects").find();
});
</script>
```

```ts [plugins/database.ts] 
import { MongalayerClient } from "@mongalayer/client";

export default defineNuxtPlugin(async nuxtApp => {
    const client = new MongalayerClient("https://...", {
        headers: async () => {
            const session = await getSession(); // Dummy function
            return { Authorization: session.token };
        }
    });

    const database = client.db("myDatabase");

    return {
        provide: {
            database
        }
    }
})
```

```ts [model/project.ts] 
import z from "zod";

export class Project {
    constructor(
        public _id: string,
        public name: string,
        public description: string,
        public ownerId: string,
        public createdAt: Date,
    ) { }

    static schema = z.object({
        _id: z.string(),
        name: z.string(),
        description: z.string(),
        ownerId: z.string(),
        createdAt: z.date()
    });
}
```

```ts [access/project.ts] 
import { AccessPermissions } from "@mongalayer/server";
import type { AccessConfig } from "@mongalayer/server";
import type { Project } from "model/project";

const projectAccess: AccessConfig<Project> = [{
    role: "owner",
    filter: {
        ownerId: "%%user.sub"
    },
    document: AccessPermissions.ReadWrite,
    fields: {
        // CreatedAt is read-only after creation
        createdAt: AccessPermissions.ReadWrite ^ AccessPermissions.Update 
    },
    delete: true
}, {
    role: "user",
    filter: {}, // Public
    document: AccessPermissions.Read
}];

```
:::
::

::u-page-section{class="dark:bg-neutral-950"}
#title
Key Features

#features
  :::u-page-feature
  ---
  icon: i-lucide-shield
  ---
  #title
  Role-Based Access Control

  #description
  Define granular access roles with document-level and field-level permissions. Control who can read, create, update, and delete data.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-check-circle
  ---
  #title
  Schema Validation

  #description
  Define your document schemas with Zod. All payloads are validated automatically before reaching MongoDB.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-code
  ---
  #title
  Full Type Safety

  #description
  End-to-end TypeScript types from server to client. Actions, payloads, and return types are all fully typed.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-database
  ---
  #title
  MongoDB CRUD Operations

  #description
  Supports find, findOne, findOneAndUpdate, aggregate, insertOne, insertMany, updateOne, updateMany, deleteOne, and deleteMany from your client code.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-globe
  ---
  #title
  Client SDK

  #description
  A lightweight client library that communicates with the Mongalayer server over HTTP. Works in any JavaScript environment with fetch.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-lock
  ---
  #title
  Bring Your Own Auth

  #description
  Authentication and authorization of HTTP requests is handled by you. Mongalayer focuses on data access control, not transport security.
  :::
::
