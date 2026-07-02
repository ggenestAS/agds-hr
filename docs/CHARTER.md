# agds-hr charter

Live source of truth: scope, pinned decisions, deferred items with named
triggers, settled questions. One head's length; overflow goes to a decision
file. The frozen founding document is
[new-project-directives.md](./new-project-directives.md) — this charter tracks
where agds-hr is against it.

## What this is

agds-hr is the HR platform for Albert School, built on the keystone DNA: Bun,
TanStack Start, Drizzle on Neon Postgres, BetterAuth (SSO-only), schema-per-
domain packages, day-one audit, mechanical gates for every convention.

## First principles

Restated in full in [new-project-directives.md §1](./new-project-directives.md);
binding here:

1. The skeleton must fit in one head.
2. Boring beats clever — new dependency/runtime/pattern requires a decision record.
3. Defer aggressively, with named triggers (table below).
4. Boundaries are mechanisms, not conventions.
5. Auditability is a day-one concern.
6. The codebase is the system of record.
7. Fail closed.

## Bootstrap status

Tracking the founding document's §17 bootstrap order:

| Step | Content                                                                                 | Status  |
| ---- | --------------------------------------------------------------------------------------- | ------- |
| 1    | Repo scaffold: workspaces, tsconfig, oxlint/oxfmt, lefthook, docs, CI static            | done    |
| 2    | `packages/shared` + `packages/env` (+ `check:env`)                                      | done    |
| 3    | `packages/db`: four-role selector, setup-roles.sql, first migration, `check:migrations` | done    |
| 4    | `packages/domains/audit`: append-only events + trigger + `recordEvent`                  | done    |
| 5    | `packages/auth` + `packages/domains/identity`                                           | pending |
| 6    | `apps/web`: shell, session gate, server-fn triple, UI discipline, app gates             | pending |
| 7    | Test harness: disposable-branch wrapper + sentinel, coverage gate, CI test job          | pending |
| 8    | Dev workflow scripts: `new-feature`, `commit:safe`, `check:orient`, `new-domain`        | pending |
| 9    | One reference domain end-to-end                                                         | pending |
| 10   | First product domain, via a plan in `docs/plans/`                                       | pending |

## Pinned decisions

- Stack pinned as in the founding document §2; prerelease lines recorded in
  [2026-07-02-stack-and-prerelease-dependencies.md](./decisions/2026-07-02-stack-and-prerelease-dependencies.md).
- Four Postgres runtime roles with grants shipped inside migrations:
  [2026-07-02-database-roles-and-migrations.md](./decisions/2026-07-02-database-roles-and-migrations.md).
- Audit domain ships before any product domain; append-only enforced by
  trigger, not convention.
- SSO-only auth, no self-service sign-up, workspace allow-list hardcoded in
  the auth package (when step 5 lands).

## Deferred, with named triggers

| Item                                                       | Trigger                                                          | Status   |
| ---------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| CI `test` job with coverage gate                           | step 7 lands (test harness + disposable DB branches)             | deferred |
| App-convention gates (`check:nav`, `check:client-barrels`) | step 6 lands (`apps/web` exists)                                 | deferred |
| 100% coverage ratcheting allowlist                         | step 7 lands (coverage gate exists)                              | deferred |
| MFA / external-IdP SSO                                     | a user population outside Google Workspace MFA coverage          | deferred |
| `success` / `info` semantic colors                         | a surface needs one                                              | deferred |
| Per-PR ephemeral CI DB branches                            | PR volume makes the shared `ci` branch queue a bottleneck        | deferred |
| Transactional outbox / `id_map` / legacy bridge            | an external system must observe writes / a legacy system appears | deferred |
| Telemetry domain (`telemetry.event` stream)                | step 6 lands (first server-fn boundary to instrument)            | deferred |
| Domain roles beyond `staff`/`developer`                    | first product domain defines its audiences                       | deferred |

## Settled questions

- Package scope is `@agds-hr/*`; the audit schema is `audit`, its table
  `events`.
- Audit `INSERT` is granted to `app_role` and `admin_role` (privileged
  actions run on the admin connection and must audit in-transaction);
  `readonly_role` gets `SELECT`; `webhook_role` gets `INSERT` only when a
  webhook receiver performs an audited mutation — not granted yet.
- Roles start as `staff` + `developer` (founding doc §6.3); product roles are
  added by the domain that needs them.
