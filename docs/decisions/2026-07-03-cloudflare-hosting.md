Status: frozen

# Cloudflare Workers hosting

Date: 2026-07-03

## Context

The founding document pinned **Vercel** (Nitro output) for `apps/web`. Deploy
wiring was still deferred (web-shell plan). The operator chose Cloudflare for
app hosting; object storage was already pinned to **R2**. Neon Postgres stays
the database — Workers connect over the network, same as any edge host.

TanStack Start ships first-class Cloudflare support via `@cloudflare/vite-plugin`
and `wrangler` (see Cloudflare's TanStack Start framework guide). The app
already uses a custom `src/server.ts` entry to mount BetterAuth ahead of the
Start handler — TanStack Start resolves `src/server.ts` automatically.

## Decision

Host `apps/web` on **Cloudflare Workers** using:

- `@cloudflare/vite-plugin` in `vite.config.ts` (`viteEnvironment.name: "ssr"`)
- `wrangler.jsonc` at `apps/web/` with `nodejs_compat`
- `bun run deploy` → `vite build` + `wrangler deploy` from `@agds-hr/web`

Cron (when `packages/cron` lands): **Cloudflare Cron Triggers** calling
`/api/cron/run/<jobId>` with a `CRON_SECRET` bearer — not Vercel Cron.

Auth origins: keep hardcoded `TRUSTED_ORIGINS` for localhost and production
custom domain; set `BETTER_AUTH_URL` per Cloudflare environment (Workers
dashboard secrets) for each deployed hostname including `*.workers.dev` previews.

Database: Neon connection strings via Workers secrets/env — no D1 migration.
Revisit **Hyperdrive** when connection pooling or cold-start latency becomes
measurable (charter-style named trigger, not day-one).

Supersedes the hosting row in [new-project-directives.md](../new-project-directives.md)
(Vercel → Cloudflare Workers). Does not supersede R2, Resend, Neon, or BetterAuth
choices.

## Alternatives considered

- **Stay on Vercel** — Rejected per operator choice; R2 + app on one vendor
  simplifies ops for this project.
- **Cloudflare Pages (static) only** — Rejected; SSR, server functions, and
  BetterAuth require a Worker runtime.
- **Move Postgres to D1** — Rejected; four-role grant model, audit triggers,
  and Neon branch workflow are built around Postgres — migration cost dominates.

## Consequences

- Deploy requires Cloudflare account auth (`wrangler login` or CI token).
- Preview URLs use account-specific `*.workers.dev` hostnames — each preview
  env needs `BETTER_AUTH_URL` (and Google OAuth redirect URI) configured.
- `nodejs_compat` is required for the `postgres` driver and BetterAuth.
- Dev and production build require **Node ≥22.12** (`@cloudflare/vite-plugin`
  uses `registerHooks` from `node:module`); Bun's runtime cannot load the
  plugin, so the `dev`/`build` aliases run Vite under Node (no `--bun`).
- CI deploy job is a follow-up once the test harness (bootstrap step 7) lands.

## Addendum (2026-07-03, same day): request-scoped db clients, Hyperdrive, Smart Placement

The Hyperdrive trigger above fired on day one. Two production findings:

1. **Workers forbid cross-request sockets.** The module-level client memo in
   `packages/db` handed warm isolates dead connections — every query on a
   reused isolate failed ("Failed query" on `auth.verification`, breaking
   OAuth). Fix: the client cache is request-scoped via `AsyncLocalStorage`
   (`runWithRequestDbScope`, wrapped around the Worker fetch in
   `apps/web/src/server.ts`); the process-level cache remains for dev/tests/
   scripts. `getAuth()` follows by keying its memo on the admin db instance.
2. **Per-request connections made navigation slow.** Fresh TCP+TLS+SCRAM to
   Neon per server-function call measured 300–450ms baseline, 1.4–1.9s worst.

Resolution:

- **Hyperdrive** (one config per db role, bindings `HYPERDRIVE_APP/_ADMIN/
_READONLY/_WEBHOOK` in `wrangler.jsonc`) pools connections at the edge;
  per-request clients become cheap. Query caching is **disabled** on all four:
  the OAuth flow reads `auth.verification` immediately after writing it, and
  session reads must not be stale. `worker-env.ts` maps each binding onto its
  `DATABASE_URL*` var so `@agds-hr/db` stays provisioning-agnostic.
- `DATABASE_URL*` are no longer synced as Worker secrets (deploy-worker.ts);
  Hyperdrive bindings are the only production db path — fail closed if absent.
- **Smart Placement** (`placement.mode: "smart"`) moves execution near Neon
  (eu-central-1) because requests make several sequential db round trips.
- Local dev: wrangler needs
  `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` vars (see
  `.env.example`) to proxy the bindings to the developer's Neon branch.

## Related

- [Stack and prerelease dependencies](./2026-07-02-stack-and-prerelease-dependencies.md) — hosting line superseded here
- [Auth, identity, session, and the policy engine](./2026-07-02-auth-identity-session-and-policy.md)
- [web-shell plan](../plans/web-shell.md)
