# New-project directives — the keystone DNA

Directives for starting a **new project** that shares keystone's tech stack, auth stack, architecture, tooling, and coding principles. The bar: an expert engineer, after detailed investigation of both codebases, should conclude they were written by the same person.

This file is self-contained and portable — it was copied into this repo as its founding document with `<project>` already replaced by `agds-hr`; follow it top to bottom. Where keystone earned a rule through an incident or an ADR, the rule is restated here in full so the new project does not need to read keystone to comply. Keystone-specific context (the V1 strangler-fig migration, school domains, project IDs) is deliberately generalized; the _patterns_ it produced (outbox, id_map, import-on-build) are kept as recipes for whenever the new project has a legacy system or external write-back of its own.

---

## 1. First principles

These are constraints, not aspirations. Every structural decision in the codebase must be traceable to one of them.

1. **The skeleton must fit in one head.** A new contributor reads the whole repo layout and one reference flow in five minutes without flipping back. If a future domain doesn't fit that test, the skeleton is wrong.
2. **Boring beats clever.** No experimental patterns in the foundation. Every stack choice below is already understood; the project proves the bets compose, it does not introduce new bets. Adopting a new dependency, runtime, or pattern requires a decision record (§14).
3. **Defer aggressively, with named triggers.** Anything not required now is out of scope, and every deferred item gets a _named trigger_ recorded in the charter ("revisit when X becomes true"). Status is one of `deferred` / `trigger fired` / `dropped` — never an untracked "later".
4. **Boundaries are mechanisms, not conventions.** Lint rules, workspace package boundaries, CI script gates, DB role grants. If a boundary depends on remembering to do the right thing, it isn't a boundary.
5. **Auditability is a day-one concern.** The audit domain ships with the core, not after. You can't backfill what you didn't capture.
6. **The codebase is the system of record.** Every decision that shapes the codebase is committed to the repo as code or markdown — no Linear, no Notion, no external design tool, no decision living in a chat thread. When a future contributor asks "why is it like this?", the answer must be discoverable in the repo without asking anyone.
7. **Fail closed.** Deactivated users lose access on the next request; an unregistered policy action is a deny; a missing allow-list entry is a rejection; test tooling refuses to run against a non-test database. Whenever a check can't run, the answer is "no".

## 2. Stack (pinned)

| Layer                                   | Choice                                                                                                                                                            | Notes                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime / package manager / test runner | **Bun** (workspaces, `bun test`, `bun run` aliases)                                                                                                               | One tool; pin the version in CI (e.g. `1.3.x`).                                                                |
| Web framework                           | **TanStack Start** (+ TanStack Router) on **Vite** (rolldown-vite) + **Nitro**                                                                                    | File-based routes, `createServerFn`, SSR. React 19.                                                            |
| Data layer                              | **Drizzle ORM** (v1 beta line) on **Neon Postgres** (EU region)                                                                                                   | Per-developer Neon branches; no local Docker. `postgres` driver.                                               |
| Auth                                    | **BetterAuth**, self-hosted as a library inside the web app                                                                                                       | Sessions and credentials live in the same Postgres as the domains, in an `auth` schema.                        |
| Validation                              | **Zod v4**                                                                                                                                                        | At every route/server-fn boundary. Pin with a workspace override.                                              |
| Data fetching (client)                  | **TanStack Query v5** (+ TanStack Form, Pacer, Virtual, Hotkeys as needed)                                                                                        | `staleTime: 30_000` default; loaders do the first fetch.                                                       |
| UI                                      | **shadcn on Tailwind v4** (CSS-first config, neutral OKLCH palette), `cva` variants, Radix (unified `radix-ui` package), `cn()` = clsx + tailwind-merge           | Icons: `@hugeicons/react`. Toasts: `sonner`. Fonts: IBM Plex Sans Variable + IBM Plex Mono, self-hosted woff2. |
| Lint / format / typecheck               | **oxc**: `oxlint --type-aware --type-check` replaces `tsc --noEmit`; **oxfmt** formats                                                                            | No ESLint, no Prettier.                                                                                        |
| Object storage                          | **Cloudflare R2** via a thin `@agds-hr/storage` package (presigned URLs, AWS SDK v3 S3 client)                                                                    |                                                                                                                |
| Transactional email                     | **Resend**, behind a domain `email` package (`sendTransactional` + template registry + `email.send_log` table); `EMAIL_DRY_RUN=true` everywhere except production |                                                                                                                |
| Hosting                                 | **Vercel** (Nitro output), Vercel Cron hitting `/api/cron/run/<jobId>` guarded by `CRON_SECRET` bearer                                                            |                                                                                                                |
| Git hooks                               | **lefthook**, installed by the `prepare` script                                                                                                                   |                                                                                                                |
| Dead code                               | **knip** (advisory, not gated)                                                                                                                                    |                                                                                                                |

Prerelease/beta dependencies are acceptable when the stable line is the clear successor (drizzle v1 beta, nitro beta) — record the choice in a decision file.

## 3. Monorepo layout

```
apps/web/                      # the one TanStack Start app — audience route groups, server functions
packages/
├── shared/                    # branded ids, error types, PolicyDecision, closed role tuples — the ONLY client-safe barrel
├── env/                       # lazy env reads + typed ENV_MANIFEST (system of record for env vars)
├── db/                        # Drizzle client, four-role selector getDbAs(), relations registry, migrations/
├── auth/                      # BetterAuth wrapper, session materialization, policy engine (assertCan)
├── storage/                   # R2 presigned-URL wrapper
├── cron/                      # cron job registry types + runner
├── domains/
│   ├── audit/                 # append-only audit.events; recordEvent + listEvents — ships first
│   ├── identity/              # users, roles, relationships, impersonation — ships second
│   ├── telemetry/             # append-only unified analytics+observability event stream
│   └── <domain>/              # one package per product domain
└── integrations/
    └── <system>/              # thin, domain-agnostic external-system clients
scripts/
├── ci/                        # permanent gates + test harness (run by lefthook and CI)
├── dev/                       # worktree / db-profile / commit tooling (humans + agents)
├── ops/                       # repeatable operator mutations (loaded with .env)
├── debug/                     # EPHEMERAL incident scripts — promote to ops/ or delete
├── lib/                       # shared script helpers (progress logger, …)
├── db/                        # one-time SQL (setup-roles.sql)
└── data/                      # static JSON snapshots for backfills
docs/
├── CHARTER.md                 # LIVE source of truth: scope, pinned decisions, deferred table with triggers
├── decisions/                 # FROZEN dated ADRs (YYYY-MM-DD-slug.md) + 0000-template.md + README index
└── plans/                     # domain plans with Status/Readiness lifecycle + 0000-template.md + completed/
AGENTS.md                      # thin always-on operating rules; nested AGENTS.md per area
```

Bun workspaces: `apps/*`, `packages/*`, `packages/domains/*`, `packages/integrations/*`. All packages are `"private": true`, `"version": "0.0.0"`, `"type": "module"`, cross-referenced with `workspace:*`, named `@agds-hr/<name>`. Root `tsconfig.json` maps every `@agds-hr/*` to its `src/index.ts` barrel (plus explicit subpath entries); each package's tsconfig is just `{"extends": "<base>", "include": ["src"]}`. Imports use **explicit `.ts` extensions** (`import { x } from "./dal.ts"`).

**Each package's `index.ts` is the only public boundary** — an exhaustive explicit named re-export list (never `export *`, except the `shared` barrel). Server-only code lives behind the barrel; client-safe slices get dedicated `package.json` `exports` subpaths kept free of DB/IO imports (§9.5).

## 4. TypeScript & tooling configuration

`tsconfig.base.json` — copy exactly:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
  },
}
```

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are non-negotiable — they shape the house idioms (the `...(x ? { x } : {})` optional-spread, explicit `undefined` handling on indexing).

- `.editorconfig`: UTF-8, LF, final newline, trim trailing whitespace (markdown exempt), 2-space indent.
- `.oxlintrc.json` stays minimal — oxlint defaults, plus one override banning `no-console` and empty catches in the gated application-service layer (`apps/web/src/server/*.impl.server.ts` and domain service subfolders). Scripts may `console.log` freely.
- `lint` = `oxlint --type-aware --type-check` over the tree; there is no separate `tsc` step.
- `format` = `oxfmt`.
- Every non-app package's only script: `"typecheck": "oxlint --type-aware"`.

**lefthook pre-commit** (parallel, glob-scoped): oxfmt over staged files (`stage_fixed: true`); `lint:staged` (oxlint over staged files **plus their 1-hop reverse import closure**); `check:docs`; `check:migrations`; `check:env`; app-convention gates (`check:nav`, `check:client-barrels`); `test:staged --bail` (unit tests over the staged scope + always-on invariant tests). Pre-commit is the fast staged-scope gate; CI is the full-tree gate. Hooks are wired by `"prepare": "lefthook install"` on `bun install`.

## 5. Database discipline

### 5.1 Four runtime roles

Four Postgres login roles, created once by `scripts/db/setup-roles.sql`, each with its own connection string:

| Role            | Env var                 | Purpose                                               | Pool |
| --------------- | ----------------------- | ----------------------------------------------------- | ---- |
| `app_role`      | `DATABASE_URL`          | Normal runtime                                        | 10   |
| `admin_role`    | `DATABASE_URL_ADMIN`    | Privileged app actions (auth CRUD, cross-user writes) | 5    |
| `readonly_role` | `DATABASE_URL_READONLY` | Read-only surfaces, agent/MCP telemetry queries       | 10   |
| `webhook_role`  | `DATABASE_URL_WEBHOOK`  | Inbound webhook receivers, outbox relay               | 5    |

Plus `DATABASE_URL_MIGRATE` (the Neon project owner) used only by drizzle-kit and one-time SQL. `packages/db` exposes exactly one API:

```ts
export type DbRole = "app" | "admin" | "readonly" | "webhook";
export function getDbAs(role: DbRole): DrizzleDb; // lazy pool + memoized drizzle per role
export type DrizzleExecutor = DrizzleDb | DrizzleTx;
```

Missing env throws a self-diagnosing error pointing at `.env.example`. Nothing connects at import time.

### 5.2 Schema-per-domain, one migration chain

Each domain owns a `pgSchema("<domain>")` defined in `packages/domains/<domain>/src/db/schema.ts` (exported as the `./db/schema` subpath). One workspace-level `drizzle.config.ts` lists every domain's `schema.ts` in an explicit array, outputs to `packages/db/migrations`, uses `DATABASE_URL_MIGRATE`, `strict: true`, `verbose: true`. Adding a domain = appending one path.

**Grants ship in the same migration as the tables.** A domain's first migration creates the schema and grants explicitly per role — this is how the role split is enforced at the SQL layer, not just by connection strings:

```sql
CREATE SCHEMA "orders";
--> statement-breakpoint
GRANT USAGE ON SCHEMA "orders" TO app_role, admin_role, readonly_role;
GRANT SELECT, INSERT, UPDATE ON "orders"."order" TO app_role, admin_role;
GRANT SELECT ON "orders"."order" TO readonly_role;
```

No blanket `GRANT ON ALL TABLES`. Audit is write-restricted (`INSERT` only for `app_role`) and **append-only via a trigger** that raises on `DELETE`/`TRUNCATE` unless a transaction-local `set_config` sentinel is set (only the test reset sets it).

Migration hygiene: `bun run db:generate -- --name <slug>` then `db:migrate`; never hand-edit `meta/_journal.json`; every schema-changing migration carries its `snapshot.json`; a CI check (`check:migrations`) asserts the snapshot chain is strictly linear (single parent, unique ids, sortable timestamped folder names). Never simulate or bypass drizzle-kit's interactive create-vs-rename prompts — guessing forks the snapshot chain; stop and ask.

### 5.3 Table conventions

- Column names `snake_case` in Postgres, `camelCase` in TypeScript, mapped explicitly in exactly one place per DAL.
- UUID primary keys. Timestamps `timestamptz`; `createdAt` defaulted, `updatedAt` via `.$onUpdate(() => new Date())`.
- **Soft delete is the default:** `deletedAt timestamptz` + `deletedBy uuid`, a partial index on active rows (`.where(sql`${t.deletedAt} is null`)`), reads filter `isNull(deletedAt)` unless an explicit `includeDeleted` flag, and "delete" is an `update` setting `deletedAt`/`deletedBy`. Hard `DELETE` is a per-table exception you justify in a decision record.

### 5.4 Closed enum / type discipline

Bounded string sets that land in Postgres follow one pipeline with a single source of truth:

1. **`as const` tuple** in `@agds-hr/shared` or the owning domain's `types.ts`.
2. **TS union derived from the tuple** — `type X = (typeof X_VALUES)[number]` — never a hand-written duplicate.
3. **Drizzle `pgSchema.enum(..., [...TUPLE])`** built from the same tuple.
4. **Zod `z.enum(TUPLE)`** at route boundaries — import the tuple, never inline literals.
5. No redundant runtime narrowers once the column is a pg enum.

Product subsets get named tuples + guards (`DIRECTORY_USER_ROLES`, `isDirectoryUserRole` — `as const satisfies readonly UserRole[]`), never `Exclude<>` or string comparisons at call sites. Open vocabularies (audit event types, outbox kinds, policy action strings) are deliberately out of scope — those stay open `text`.

## 6. Auth stack

### 6.1 BetterAuth configuration

BetterAuth runs as a library inside `apps/web` (catch-all route `src/routes/api/auth.$.ts`), wrapped in `packages/auth`. Configuration invariants:

- **Lazily built and cached** (`getAuth()`), so type-only importers pay no env/DB cost and nothing fails at import.
- Drizzle adapter over `getDbAs("admin")`, `provider: "pg"` — BetterAuth owns the `auth` schema (`user`, `session`, `account`, `verification`) in the same Postgres as the domains. `generateId: "uuid"`.
- **`emailAndPassword: { enabled: false }`** — SSO-only. `disabledPaths` block `/sign-in/email`, `/sign-up/email`, and crucially **`/update-user`**, so profile writes cannot bypass the domain DAL's policy+audit path.
- **No self-service sign-up.** Users must be provisioned before they can sign in (`disableSignUp: true`, `disableImplicitSignUp: true` on every provider/plugin). Bootstrap the first privileged user with a documented one-time SQL insert.
- **Google Workspace SSO as the primary path**, restricted to an allow-list of workspace domains **hardcoded as a constant in the auth package, not an env var** (the code is the system of record; env-configurable allow-lists drift). The profile-mapping callback is the security boundary: reject when `!email_verified` or `id_token.hd` is not in the allow-list, with `snake_case` error codes (`google_workspace_mismatch`). Personal accounts never complete sign-in regardless of provisioning.
- Optional `magicLink` plugin for passwordless audiences: sign-in only (`disableSignUp: true`), 15-minute expiry, `storeToken: "hashed"`, delivery delegated to a sender the app layer registers.
- MFA and external-IdP SSO are **deferred with named triggers** (upstream Workspace MFA covers staff; app-layer MFA would be duplicative).
- App-owned profile columns are declared as BetterAuth `additionalFields` and mirrored in the schema; runtime roles get **column-level** grants on exactly those columns, never on BetterAuth's own `name`/`email`/`image`.
- Origin resolution: on Vercel, trust `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` per-request (previews work with zero config); `BETTER_AUTH_URL` set only for local dev and custom-domain production. Include the loopback-port reconciliation helper (rewrite a stale `localhost` URL's port to `process.env.PORT`) so parallel dev worktrees on different ports sign in without editing `.env`. Expose it as a client-safe subpath.
- Auth event logging forwards to a registered callback that **must never throw** — telemetry must not break the auth path.

### 6.2 Session: actor / subject

```ts
export type Session = {
  readonly actor: User; // the authenticated human
  readonly subject: User; // the effective user policies run against (differs under impersonation)
  readonly authSessionId: string;
  readonly requestId: RequestId;
};
export type User = {
  readonly id: UserId;
  readonly email: string;
  readonly roles: readonly UserRole[];
  readonly relationships: UserRelationships;
};
```

`resolveSession(request)` does one DB read: BetterAuth session → **fail closed if the user is deactivated** (a valid cookie does not survive deactivation) → hydrate actor → check active impersonation → subject = impersonated user or actor. Impersonation state is one row per actor in `identity.impersonation_session`, and starting/stopping it is an audited identity-domain action.

### 6.3 Policy engine

A registry-based engine in `packages/auth`, deny-all by default:

```ts
export type PolicyDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };
export const ALLOW: PolicyDecision = { allow: true };
export const DENY = (reason: string): PolicyDecision => ({ allow: false, reason });

registerPolicy(action: string, handler: (user: User, resource?: unknown) => PolicyDecision): void;
assertCan(user: User, action: string, resource?: unknown): void; // throws ForbiddenError on deny
```

- Actions are dotted strings: `"identity.profile.update"`, `"orders.invoice.read"`. Unregistered action → `DENY("unregistered_action")`. Double registration throws. Deny reasons are `snake_case` (`staff_required`, `not_owner_or_staff`).
- **Each domain exports pure policy predicate functions** in its `policies.ts` (no DB imports). The **composition root** — `apps/web/src/server/policies.ts` — imports them all and calls `registerPolicy` at boot, made idempotent against dev HMR via a bootstrap-probe action.
- User roles are rows in `identity.user_role` (PK `[userId, role]`, pg enum from the shared tuple, `grantedAt`/`grantedBy`). Include a `developer` role from day one for platform/ops surfaces, distinct from the ordinary staff role.

## 7. The `shared` package — primitives

**Branded IDs** — the exact idiom, one type + same-named constructor per id, declaration-merged:

```ts
export type Brand<T, B> = T & { readonly __brand: B };
export type UserId = Brand<string, "UserId">;
export const UserId = (s: string): UserId => s as UserId;
```

Constructors are plain casts (no validation) except `Email`, which validates and throws. IDs for planned-but-unbuilt domains are still defined centrally here so policies compile today; domains re-export rather than redefine.

**Errors** — a small closed set of `Error` subclasses with structured public readonly fields and machine-parseable `snake_case:`-prefixed messages:

```ts
export class ForbiddenError extends Error {
  constructor(
    public readonly action: string,
    public readonly reason: string,
  ) {
    super(`forbidden: ${action} (${reason})`);
    this.name = "ForbiddenError";
  }
}
// NotFoundError → `not_found: ${resource}#${id}`; ConflictError; UniqueViolationError → `unique_violation: ${constraint}(...)`
```

Errors are **thrown, not returned**; the web error boundary regex-parses the `forbidden:` prefix into friendly copy. Also here: `PolicyDecision`/`ALLOW`/`DENY`, `RequestId`, the canonical role tuples and subsets, and display helpers. This is the **only client-safe barrel**.

## 8. Domain package anatomy

Every product domain is one package with this flat layout (no repo/service split — the DAL is the data layer):

```
packages/domains/<domain>/
├── package.json          # exports: "." → src/index.ts, "./db/schema" → src/db/schema.ts
├── tsconfig.json
└── src/
    ├── index.ts          # explicit named re-exports — the ONLY public boundary
    ├── types.ts          # closed-enum tuples, unions, guards, readonly interfaces
    ├── db/schema.ts      # pgSchema + tables + pg enums (from the tuples)
    ├── dal.ts            # all queries + mutations
    ├── policies.ts       # pure (user, resource) => PolicyDecision predicates
    └── *.test.ts         # co-located tests
```

Pure algorithmic logic gets its own files next to `dal.ts` (unit-tested, no DB). Build a `new-domain` generator script early that scaffolds exactly this skeleton plus the app-side triple (§9.3) with `TODO(<domain>):` markers, and prints the non-scaffoldable steps (drizzle.config entry, grants, policy registration, nav mount, test-reset entry).

### 8.1 The DAL signature convention

```ts
// reads: executor-agnostic, no audit context
export async function getOrder(db: DrizzleExecutor, id: OrderId): Promise<Order | undefined>;

// mutations: own their transaction, always take AuditContext last
export async function cancelOrder(db: DrizzleDb, id: OrderId, context: AuditContext): Promise<void>;
```

`AuditContext = { actorUserId, subjectUserId, requestId, ip? }`. Policy checks (`assertCan`) are the **caller's** responsibility (server function layer), not the DAL's — the audit row needs actor+subject, which `assertCan` never sees.

### 8.2 The central mutation idiom — state + audit (+ outbox) in one transaction

```ts
export async function deactivateUser(db: DrizzleDb, userId: UserId, context: AuditContext) {
  await db.transaction(async (tx) => {
    await tx.update(user).set({ deactivatedAt: sql`now()` }).where(...);
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "user.deactivated",   // open vocabulary, dotted
      resourceId: userId,
      payload: {},                      // updates carry a per-field diff: { field: { before, after } }
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    // only when an external system must observe the write:
    await enqueueOutboxEvent(tx, { kind: "identity.user.deactivated", idempotencyKey: `...${userId}.${context.requestId}`, payload: {...} });
  });
}
```

Every mutation is audited in the same transaction. Audit `subjectUserId` is **the human the action is about**; `actorUserId` is the person doing it — same on self-service, different on every cross-user privileged action. Privileged _reads_ of the audit surface are themselves recorded as audit events.

### 8.3 Integrations pattern

`packages/integrations/<system>` packages are thin, **domain-agnostic** (they import no domain), read their own credentials from env with an `is<X>Configured()` predicate, and carry a **fixture/dry-run mode** so tests and dev never hit the live service (synthetic fixture responses, `EMAIL_DRY_RUN`, safe-mode flags). Prefer raw `fetch` over heavyweight SDKs; verify inbound webhook signatures with hand-rolled HMAC + `timingSafeEqual`; webhooks connect as `webhook_role`.

For any external system that must observe writes, use the **transactional outbox**: an `outbox.event` table (`kind`, `payload jsonb`, `idempotency_key UNIQUE`, `delivered_at`, `attempts`, `last_error`, `dead_letter_at`), `enqueueOutboxEvent` inside the domain's write transaction (idempotent via `onConflictDoNothing`), and a generic `relayOutbox(db, deliver, { isTerminal })` drained by a cron — at-least-once with receiver-side dedup on the idempotency key, capped attempts, terminal errors dead-lettered, plus a developer monitoring/replay surface. For bridging a legacy system, add an `id_map(entity, legacy_id, v2_id)` table (unique both directions per entity) and verbatim-capture archive sidecar tables; all legacy access goes through its HTTP API (never its database), through a single `call<Legacy>` client with a process-wide concurrency semaphore and jittered exponential backoff honoring `Retry-After`.

## 9. The web app

### 9.1 Routing

- Flat file-based routes in `src/routes/`, dot-delimited, `$param` for path params. `__root.tsx` owns the document shell (FOUC-prevention inline script for theme, inline `@font-face`, `TooltipProvider`, `Toaster`, error boundary; body clamped `h-dvh overflow-hidden` — panes scroll, the page never does).
- `_app.tsx` is the pathless authenticated layout: `beforeLoad` loads the session (redirect to `/sign-in?from=` when absent) and gates per-route **feature flags** (default-off routes; developers bypass with a visible warning banner).
- **Audience route groups by filename prefix**: `_app.staff.*`, `_app.me.*`, `_app.developer.*`, etc. Sign-in/sign-up/public pages sit outside the shell.
- Router defaults: `defaultPreload: "intent"`, `scrollRestoration: true`, a global pending component with `defaultPendingMs: 150` / `defaultPendingMinMs: 200`, per-shape route skeletons in `components/route-pending/`.
- Server routes under `src/routes/api/`: the BetterAuth catch-all, one cron runner (`api/cron/run.$jobId.ts` → registry, bearer-guarded by `CRON_SECRET`), and one file per inbound webhook.
- Route tree generated by `tsr generate` (wired as `postinstall`); `routeTree.gen.ts` is gitignored.

### 9.2 URL state

"What am I looking at" lives in the URL; "what am I momentarily touching" stays local.

- **URL-driven (required):** filters, search text, tab/sub-view, sort, pagination, addressable overlays — via `validateSearch` + Zod + `stripSearchParams` + `Route.useSearch()` / `Route.useNavigate()`.
- **Local `useState`:** popovers, hover/focus, unsaved drafts, pending flags.
- Per route: default every param, strip defaults from the URL, `replace: true` for high-frequency writes (search/filter), default push for tab switches. Server-driven filters: `loaderDeps: ({ search }) => search`. One shared `useDebouncedSearch` hook (instant local value, debounced URL write).

### 9.3 Server function layering — the triple

Per domain, three files in `apps/web/src/server/`:

| File                      | Role                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `<domain>.shared.ts`      | Zod schemas + `z.infer` types. Pure, importable everywhere.                                                                    |
| `<domain>.functions.ts`   | Thin RPC transport: `createServerFn({ method })` + `.validator(schema)`, delegating via a lazy-import seam. Client-importable. |
| `<domain>.impl.server.ts` | The real handlers: session/policy gates, `getDbAs`, DAL calls, audit context. Never in the client bundle.                      |

The seam (`call-server-handler.ts`) keeps impl code out of the client graph:

```ts
type OrdersImpl = typeof import("./orders.impl.server.ts");
const importOrdersImpl = () => import("./orders.impl.server.ts");
export const cancelOrderFn = createServerFn({ method: "POST" })
  .validator(cancelOrderSchema)
  .handler(async (ctx) => callImpl(importOrdersImpl, "cancelOrderHandler", ctx));
```

Conventions: `GET` for reads/loaders, `POST` for mutations; exports end `…Fn` (transport) / `…Handler` (impl); shared helpers `requireSession(action, opts)` (resolve session → register policies → `assertCan`) and `auditContext(session, request)` (defaults `subjectUserId = session.subject.id` — **override explicitly for cross-user actions**). Gated reads that should render an in-page denial (rather than throw) return a discriminated `{ allowed: true, … } | { allowed: false, reason, session }` and the route branches on it.

Wrap impl handlers in a **wide-event telemetry decorator** (`instrumentServerFn(name, handler, { trackPageView? })`): one telemetry row per boundary crossing — latency, session summary, success/error with a serialized error (recursing `cause` to a fixed depth), external-call summary — emitted via `waitUntil` so it never adds response latency, and `recordEvent` **never throws**.

### 9.4 UI discipline

- **Frame + content shapes.** Every authenticated route is a frame (collapsible nav + compact page-header bar + optional dense toolbar) wrapping exactly one of seven content shapes — **Browse, List-detail, Document, Canvas, Feed, Dashboard, Edit grid** — with **Form/wizard** and **Dialog** as overlay states. One resizable rail-width token for the secondary pane. Cards are reserved for dashboard tiles, semantic callouts, and composers — never the default wrapper around flat data. A surface that fits no shape is a new decision record, not an ad-hoc layout.
- **Variants, not className overrides.** Color/surface/chrome decisions live as `cva` variants on the primitives in `components/ui/` — `<Card variant="warning">`, never `<Card className="border-amber-500/50 …">`. New look = new variant on the primitive, tagged `// agds-hr-added — see <design-system doc>` so upstream shadcn upgrades don't blow it away, added to every semantic-color primitive under the same name. Allowed at call sites: layout utilities (`w-full`, `mt-4`, `grid-cols-2`) and a small content set (`font-mono`, `tabular-nums`, `break-all`, `whitespace-nowrap`).
- Semantic colors start at `primary`/`secondary`/`muted`/`accent`/`destructive` + an added `warning`; don't add `success`/`info` until a surface needs one (defer with a named trigger).
- **No intro paragraphs.** Route headers are eyebrow + `<h1>` only. Context earns its place in control labels, section descriptions, empty states, confirm dialogs — never a muted paragraph explaining what the page is.
- **Navigation is an anchor, not a button.** Anything that takes the user somewhere renders a real `<a>` (TanStack `<Link>`, wrapped with `asChild`); `navigate()` only for programmatic redirects. Enforced by a CI script that fails on `onClick={() => navigate(...)}`.
- **Mobile is first-class:** every route usable at 375 × 667.
- Theme: a hand-rolled `useTheme()` (`light | dark | system`, localStorage + `matchMedia`, `.dark` on `<html>`) — not next-themes; sonner wired to it.

### 9.5 Client/server import boundary

Domain barrels re-export server-only code; a single runtime barrel import in a client-scanned file drags Postgres/`node:crypto` into the browser bundle. Rules, mechanically enforced by a CI script:

- In `components/`, `routes/` (except `api/`), and `lib/`: **value-import from a subpath** (`@agds-hr/scheduling/wellbeing`), never a domain barrel. `import type` from any barrel is fine (types erase). `@agds-hr/shared` is the only allowlisted client-safe barrel.
- Server code (`src/server/**`, `*.server.ts`, `*.impl.server.ts`) imports barrels freely.

## 10. Observability

Two append-only streams, both day-one:

- **`audit.events`** — the compliance record: who did what to whom (`actorUserId`, `subjectUserId`, `domain`, dotted `eventType`, `resourceId`, `payload` diff, `requestId`, `ip`). Written inside domain transactions; append-only enforced by trigger; privileged reads audited too.
- **`telemetry.event`** — one unified analytics+observability stream (route page views, `server_action` wide events, frontend errors via a global `error`/`unhandledrejection` capture posting to a server fn, external-call summaries), with typed error columns, staff aggregate surfaces, and a read-only view + worked-queries doc so agents can debug production via SQL. `recordEvent` never throws and never adds latency (`waitUntil`).

`requestId` joins the two streams.

## 11. Environment variables

- `packages/env` exposes lazy, injectable reads: `readRequired` / `readOptional` (empty string = unset) / `isConfigured(names)` / `readValidated(name, zodSchema)`, all taking an `env: EnvSource = process.env` parameter so tests inject fakes. **Nothing validates env at import time** — the app boots with a feature's vars unset and fails with a self-diagnosing error only when the feature is exercised.
- A typed **`ENV_MANIFEST`** declares every variable's owner package, group, scope, and requirement; a CI check (`check:env`) gates three-way drift between the manifest, `.env.example`, and actual `process.env.X` reads in code.
- `.env.example` is heavily commented — every group gets a paragraph: what it's for, when it's required, how to obtain it, and a pointer to the decision record. Secrets never get real values; non-secret infra IDs (project IDs, hosts) are committed in the README so agents don't rediscover them.

## 12. Testing

- **Co-located** `foo.test.ts` next to `foo.ts`; runner is `bun:test`.
- **`[integration]` tag in the describe name** for DB-touching suites: `describe("[integration] orders domain", …)`. `test:unit` filters them out via `--test-name-pattern '^(?!.*\[integration\])'` and runs in pre-commit.
- **Integration tests truncate the database, so they run only against disposable branches.** A wrapper script remaps `TEST_DATABASE_URL_*` onto the canonical `DATABASE_URL_*` names and sets a sentinel (`AGDS_HR_TEST_DB=1`); the owner-connection test helper **fails closed without the sentinel**. A bare `bun test` refuses integration tests by construction.
- One shared `test-support.ts` (never imported by production code): `getOwnerDb()`, `resetDb()` (single `DO $$` round-trip truncating every app schema, transaction-locally bypassing the audit append-only trigger, re-seeding fixed reference data), `createTestUser`, a real-sign-in-path user factory, session-cookie minting, and `buildTestSession`.
- Deterministic fixtures: `ctx()` helpers with fixed `RequestId`s; `async function*` fakes for external-source interfaces.
- **100% line coverage, gated in CI**, on `packages/*` and the application-service layer (`*.impl.server.ts` + server domain subfolders). Thin transport (`*.functions.ts`), shared schemas, and composition roots are not gated. A **ratcheting allowlist** file holds the exceptions (one path + `# reason` per line): a listed file below 100% passes; a listed file that _reaches_ 100% fails until removed; a stale path fails; an unlisted file below 100% fails. The list only shrinks.
- Local fast loop: a sharded runner splitting `bun test --shard` across N disposable copy-on-write DB branches (default 8), no coverage; CI runs the single coverage pass.
- Test-only escape hatches in packages are `__`-prefixed exports (`__resetPolicyRegistryForTests`) with a comment stating production never calls them.

## 13. CI

GitHub Actions, two jobs:

1. **`static`** (~5 min timeout, no DB): `bun install --frozen-lockfile` → `lint` → `check:docs` → `check:migrations` → `check:env` → app-convention checks → build the web app.
2. **`test`** (`needs: static`, ~10 min): full suite with coverage against a persistent shared `ci` DB branch, then the coverage gate. Its concurrency group **queues rather than cancels** (`cancel-in-progress: false`) because runs share one branch that tests truncate; upgrade to per-PR ephemeral branches only when PR volume demands it (deferred, named trigger).

Every convention above that can be checked mechanically **is** checked by a small TypeScript script in `scripts/ci/` (each with its own co-located test): doc drift, migration-chain linearity, env manifest drift, nav-anchors, client-barrel imports. When you adopt a new convention, write its checker in the same PR — a convention without a gate is a suggestion (first principle 4).

## 14. Documentation system

Three doc kinds with distinct lifecycles — don't mix them, don't invent a fourth:

| Doc                                 | Lifecycle            | Content                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/CHARTER.md`                   | **Live**             | Scope (in / deferred / out), first principles, pinned decisions, the platform deferred table with named triggers, settled questions. One head's length; overflow goes to a decision file.                                                                                                                                              |
| `docs/decisions/YYYY-MM-DD-slug.md` | **Frozen at commit** | ADRs: Context / Decision / Alternatives considered (each "Rejected because …") / Consequences / Related. Status banner on line 1 (`frozen` or `superseded by [link]`). Never edited after commit — supersession is a new dated file with a forward link; the sole exception is path-only link fixes. Indexed in `decisions/README.md`. |
| `docs/plans/<slug>.md`              | Lifecycle-tracked    | Product/domain plans: `Status: planned → in progress → built (see ADR)`, then moved to `completed/`; an orthogonal `Readiness` axis (`draft / stakeholder-pending / needs-reworked / ready / ready + trigger-gated`) tracks spec approval. Template committed as `0000-template.md`.                                                   |

Operating rules for humans and agents live in a **thin always-on root `AGENTS.md`**, with area-specific rules split into nested `AGENTS.md` files (`apps/web/AGENTS.md`, `packages/AGENTS.md`) so they load only when working there. Substantive rule changes need a decision file; the rules are themselves a pinned decision.

Failure-mode reflexes to keep: found drift between docs and code → the code is the lock; fix the doc (or the code) in the same commit. Designed something that doesn't fit existing patterns → decision file in the same commit as the code. Renamed a file other docs reference → `rg <old-name> docs/ README.md AGENTS.md` must return nothing. A decision that matters was made in a PR comment or chat → move it into the repo.

**Prose tone:** dense, present-tense, skimmable; no throat-clearing or narrative scene-setting; written so a reader six months later understands _what_ was decided and _why the alternatives lost_; no emojis in committed prose. Code comments are the same voice — they explain _why_ (trade-offs, fail-closed reasoning, workarounds with upstream links) and cite the relevant decision file by name. Never comments that narrate what the next line does.

## 15. Developer workflow

- **Everything is `bun run <alias>`** from the repo root; every supported command is wired in root `package.json` and catalogued in `scripts/README.md` tables. Namespaced aliases: `db:*`, `check:*`, `test:*`, `debug:*`.
- **Feature worktrees:** `bun run new-feature <slug>` creates a sibling git worktree on a fresh branch, a copy-on-write DB branch (`feat-<slug>`) **plus a disposable `feat-<slug>-test` branch** for integration tests, picks a free dev port so worktrees run in parallel, writes the worktree `.env`, and runs install + migrate. `merge-feature` (refuses a dirty tree), then `teardown-feature` (removes worktree, local branch, both DB branches). Docs-only work gets a lightweight `new-plan` worktree (no DB). Parent-clone DB profiles (`db:ensure` / `db:use <dev|production>` / `db:refresh` / `db:status`) keep production credentials snapshotted in gitignored sidecar files, with a typed confirmation before switching to production.
- **Commit discipline:** commit via a `commit:safe` wrapper — stages only the explicitly named paths (never `-A`/`.`), re-checks `git diff --cached --name-status` and aborts if anything else got staged, attributes hook failures to your files vs sibling WIP, and never passes `--no-verify` (bypass only with explicit human authorization). Never `git stash`, `git reset --hard`, or broad `git restore` on paths you didn't write. Parallel agents working in the same clone are the norm: read before you act, leave unfamiliar files alone.
- Commit messages: conventional-commit style `type(scope): summary` (`feat(orders): …`, `fix(db): …`, `docs(plans): …`), lowercase summaries, plain sentences acceptable for cross-cutting work.
- An orientation command (`check:orient`) prints a one-screen digest — root/branch, ahead-behind vs origin, sibling worktrees, dirty tree, active DB branch — and runs at session start.
- Ephemeral agent coordination (inbox files under `.agents/`, gitignored) is allowed but is **never** the system of record.

## 16. Style fingerprint

The small idioms that make two codebases read as one author:

- `readonly` on nearly every interface field; tuples `as const`; subsets `as const satisfies readonly T[]`.
- Branded id constructors called at every boundary crossing: `UserId(row.id)`.
- Optional-field spread to satisfy `exactOptionalPropertyTypes`: `...(ctx.ip ? { ip: ctx.ip } : {})`.
- Lazy + memoized + injectable everywhere: `getAuth()`, `getDbAs()`, `env: EnvSource = process.env`; nothing throws at import time; every cache has a `__reset…ForTests` hatch.
- Errors thrown, not returned, from typed classes with structured fields and `snake_case:`-prefixed messages; gated _reads_ return discriminated `{ allowed }` unions instead of throwing.
- `camelCase` TS ↔ `snake_case` SQL mapped in exactly one place per DAL; raw `sql` fragments (with `::text` casts for dates) where the query builder doesn't own the table.
- Dotted open vocabularies for actions/events/kinds: `domain.entity.verb`.
- Naming: `…Fn` server functions, `…Handler` impl handlers, `<thing>Schema` Zod schemas, `is<X>` guards, `require_`-style trailing underscore only to dodge keywords.
- Heavy _why_-comments citing decision records by filename; zero _what_-comments.
- Every workaround comment names the upstream issue and the condition under which it can be deleted.

## 17. Bootstrap order

Build the skeleton in this order; each step lands with its tests and gates:

1. Repo scaffold: Bun workspaces, `tsconfig.base.json`, oxlint/oxfmt, lefthook, `.editorconfig`, `.env.example`, root `AGENTS.md`, `docs/CHARTER.md` (scope + first principles + empty deferred table), `docs/decisions/0000-template.md` + README, CI `static` job.
2. `packages/shared` (brands, errors, PolicyDecision, role tuples) and `packages/env` (reads + manifest + `check:env`).
3. `packages/db`: four-role selector, `setup-roles.sql`, drizzle config, first migration (schemas + grants), `check:migrations`.
4. `packages/domains/audit` (append-only events + trigger + `recordEvent`) — before any product domain.
5. `packages/auth` + `packages/domains/identity`: BetterAuth (SSO-only, workspace-restricted, no sign-up), session actor/subject, policy registry, roles, impersonation, audited profile writes.
6. `apps/web`: root shell, `_app` layout with session gate, sign-in, the server-fn triple pattern, shadcn primitives + variant discipline, telemetry wrapper, `check:nav` + `check:client-barrels`.
7. Test harness: `test-support.ts`, disposable-branch wrapper + sentinel, coverage gate + empty allowlist, CI `test` job on a shared branch.
8. Dev workflow scripts: `new-feature`/`teardown-feature`, `commit:safe`, `check:orient`, `new-domain` generator.
9. **One reference domain end-to-end** (the equivalent of an identity/access console): schema → DAL with audit → policies → server-fn triple → route → integration tests at 100% coverage. This flow is the template every subsequent domain copies.
10. First product domain, via a plan in `docs/plans/` using the template.

A step that tempts you to skip its gate ("we'll add the coverage gate later") is the failure mode this document exists to prevent: retrofitting discipline is 10× the cost of starting with it.
