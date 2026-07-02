// System of record for environment variables. `check:env` (scripts/ci/
// check-env.ts) gates three-way drift between this manifest, .env.example,
// and actual env reads in code — docs/new-project-directives.md §11.
//
// `requirement`:
// - "required"  — the runtime feature that owns it fails without it
// - "optional"  — feature degrades or is toggled off when unset
// - "tooling"   — read only by CLIs/scripts (drizzle-kit, one-time SQL),
//                 never by the app at runtime

export type EnvRequirement = "required" | "optional" | "tooling";
export type EnvScope = "server";

export type EnvVarSpec = {
  readonly name: string;
  readonly owner: string;
  readonly group: string;
  readonly scope: EnvScope;
  readonly requirement: EnvRequirement;
};

export const ENV_MANIFEST = [
  {
    name: "DATABASE_URL",
    owner: "@agds-hr/db",
    group: "database",
    scope: "server",
    requirement: "required",
  },
  {
    name: "DATABASE_URL_ADMIN",
    owner: "@agds-hr/db",
    group: "database",
    scope: "server",
    requirement: "required",
  },
  {
    name: "DATABASE_URL_READONLY",
    owner: "@agds-hr/db",
    group: "database",
    scope: "server",
    requirement: "required",
  },
  {
    name: "DATABASE_URL_WEBHOOK",
    owner: "@agds-hr/db",
    group: "database",
    scope: "server",
    requirement: "required",
  },
  {
    name: "DATABASE_URL_MIGRATE",
    owner: "@agds-hr/db",
    group: "database",
    scope: "server",
    requirement: "tooling",
  },
] as const satisfies readonly EnvVarSpec[];

export type EnvVarName = (typeof ENV_MANIFEST)[number]["name"];
