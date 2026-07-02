import { defineConfig } from "drizzle-kit";

// One workspace-level config; adding a domain = appending one schema path.
// `generate` never connects; `migrate` uses the Neon project owner
// (DATABASE_URL_MIGRATE) — the runtime roles cannot run DDL.
export default defineConfig({
  dialect: "postgresql",
  schema: [
    "packages/domains/audit/src/db/schema.ts",
    "packages/auth/src/db/schema.ts",
    "packages/domains/identity/src/db/schema.ts",
  ],
  out: "packages/db/migrations",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATE ?? "",
  },
});
