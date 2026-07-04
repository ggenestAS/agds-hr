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
  {
    name: "BETTER_AUTH_SECRET",
    owner: "@agds-hr/auth",
    group: "auth",
    scope: "server",
    requirement: "required",
  },
  {
    name: "BETTER_AUTH_URL",
    owner: "@agds-hr/auth",
    group: "auth",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    owner: "@agds-hr/auth",
    group: "auth",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    owner: "@agds-hr/auth",
    group: "auth",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "DEV_LOGIN",
    owner: "@agds-hr/web",
    group: "dev",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "INSIDE_API_KEY",
    owner: "@agds-hr/inside",
    group: "integrations",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "RESEND_API_KEY",
    owner: "@agds-hr/resend",
    group: "email",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "EMAIL_DRY_RUN",
    owner: "@agds-hr/resend",
    group: "email",
    scope: "server",
    requirement: "optional",
  },
  {
    name: "CRON_SECRET",
    owner: "@agds-hr/web",
    group: "cron",
    scope: "server",
    requirement: "optional",
  },
  // Deploy-time only (scripts/ops/deploy-worker.ts) — never read at runtime.
  {
    name: "CLOUDFLARE_API_TOKEN",
    owner: "@agds-hr/web",
    group: "deploy",
    scope: "server",
    requirement: "optional",
  },
] as const satisfies readonly EnvVarSpec[];

export type EnvVarName = (typeof ENV_MANIFEST)[number]["name"];
