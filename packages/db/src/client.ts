import { AsyncLocalStorage } from "node:async_hooks";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { readRequired, type EnvSource } from "@agds-hr/env";

// The one API this package exposes: a lazy pool + memoized drizzle instance
// per role. Nothing connects at import time (postgres.js opens connections on
// first query); missing env throws EnvMissingError pointing at .env.example.
// The role split is enforced by SQL grants shipped in migrations — see
// docs/decisions/2026-07-02-database-roles-and-migrations.md.
export type DbRole = "app" | "admin" | "readonly" | "webhook";
export type DrizzleDb = PostgresJsDatabase;
export type DrizzleTx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];
export type DrizzleExecutor = DrizzleDb | DrizzleTx;

const ROLE_CONFIG: Record<DbRole, { readonly envVar: string; readonly poolSize: number }> = {
  app: { envVar: "DATABASE_URL", poolSize: 10 },
  admin: { envVar: "DATABASE_URL_ADMIN", poolSize: 5 },
  readonly: { envVar: "DATABASE_URL_READONLY", poolSize: 10 },
  webhook: { envVar: "DATABASE_URL_WEBHOOK", poolSize: 5 },
};

type CacheEntry = { readonly db: DrizzleDb; readonly client: postgres.Sql };
type DbCache = Map<DbRole, CacheEntry>;

// Cloudflare Workers forbid using I/O objects (TCP sockets) created during one
// request from a later request — a module-level memo hands request B a dead
// connection from request A and every query fails. On Workers the entry point
// wraps each request in runWithRequestDbScope so clients live and die with the
// request (Neon's pooler absorbs the reconnect cost); the module cache remains
// the fallback for long-lived processes (local dev, tests, scripts). See
// docs/decisions/2026-07-03-cloudflare-hosting.md.
const requestScope = new AsyncLocalStorage<DbCache>();
const processCache: DbCache = new Map();

export function runWithRequestDbScope<T>(fn: () => T): T {
  return requestScope.run(new Map(), fn);
}

export function getDbAs(role: DbRole, env: EnvSource = process.env): DrizzleDb {
  const cache = requestScope.getStore() ?? processCache;
  const cached = cache.get(role);
  if (cached) {
    return cached.db;
  }
  const config = ROLE_CONFIG[role];
  const url = readRequired(config.envVar, env);
  const client = postgres(url, { max: config.poolSize });
  const db = drizzle({ client });
  cache.set(role, { db, client });
  return db;
}

// Test-only escape hatch — production never calls this.
export async function __resetDbForTests(): Promise<void> {
  const entries = [...processCache.values()];
  processCache.clear();
  await Promise.all(entries.map((entry) => entry.client.end({ timeout: 5 }).catch(() => {})));
}
