// Cloudflare Workers expose secrets on the fetch `env` binding, not always on
// process.env before the handler runs. Merge bindings once per request so
// @agds-hr/env readers (process.env default) see production secrets.

// Hyperdrive bindings are objects carrying a pooled connection string; map each
// onto the DATABASE_URL* var its role reads so @agds-hr/db is agnostic to how
// the URL is provisioned. Applied after plain string secrets so Hyperdrive wins
// when both exist (docs/decisions/2026-07-03-cloudflare-hosting.md).
const HYPERDRIVE_BINDINGS: Record<string, string> = {
  HYPERDRIVE_APP: "DATABASE_URL",
  HYPERDRIVE_ADMIN: "DATABASE_URL_ADMIN",
  HYPERDRIVE_READONLY: "DATABASE_URL_READONLY",
  HYPERDRIVE_WEBHOOK: "DATABASE_URL_WEBHOOK",
};

function hyperdriveConnectionString(value: unknown): string | undefined {
  if (value !== null && typeof value === "object" && "connectionString" in value) {
    const cs = (value as { connectionString: unknown }).connectionString;
    if (typeof cs === "string") {
      return cs;
    }
  }
  return undefined;
}

export function applyWorkerEnv(bindings: unknown): void {
  if (bindings === null || typeof bindings !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
  for (const [binding, envVar] of Object.entries(HYPERDRIVE_BINDINGS)) {
    const url = hyperdriveConnectionString((bindings as Record<string, unknown>)[binding]);
    if (url !== undefined) {
      process.env[envVar] = url;
    }
  }
}
