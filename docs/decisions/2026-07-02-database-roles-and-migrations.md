Status: frozen

# Database roles and migrations

Date: 2026-07-02

## Context

The founding document requires four runtime Postgres roles, schema-per-domain
with one migration chain, grants shipped inside migrations, and an append-only
audit schema enforced at the SQL layer.

## Decision

- Four login roles — `app_role`, `admin_role`, `readonly_role`,
  `webhook_role` — created once per Neon branch by
  `scripts/db/setup-roles.sql`, plus the Neon project owner as
  `DATABASE_URL_MIGRATE` used only by drizzle-kit and one-time SQL.
- `packages/db` exposes exactly one API: `getDbAs(role)` — lazy pool +
  memoized drizzle per role, pool sizes app 10 / admin 5 / readonly 10 /
  webhook 5. Nothing connects at import time; missing env throws a
  self-diagnosing error pointing at `.env.example`.
- One workspace-level `drizzle.config.ts` lists every domain's `schema.ts` in
  an explicit array, outputs to `packages/db/migrations`, `strict: true`,
  `verbose: true`, timestamped migration prefixes so filenames sort.
- Grants ship in the same migration as the tables — explicit per role, never
  `GRANT ON ALL TABLES`. drizzle-kit v1 emits one timestamped folder per
  migration (`migration.sql` + `snapshot.json`); `check:migrations` gates
  snapshot-chain linearity (single parent, unique ids, sortable folder names)
  in CI and pre-commit.
- `audit.events` is append-only via a trigger raising on UPDATE/DELETE (and a
  statement trigger on TRUNCATE) unless the transaction-local sentinel
  `set_config('agds_hr.allow_audit_reset', '1', true)` is set — only the test
  reset sets it. Audit `INSERT` goes to `app_role` and `admin_role`;
  `readonly_role` gets `SELECT`.

## Alternatives considered

- **One superuser connection string** — Rejected because the role split is a
  boundary-as-mechanism: a read-only surface physically cannot write.
- **Grants managed out-of-band (console, ops script)** — Rejected because
  grants drift from tables unless they ship in the same migration.
- **Append-only by convention (no trigger)** — Rejected because a convention
  without a mechanism is a suggestion; compliance data must not be deletable
  by application code.

## Consequences

- A new Neon branch needs `setup-roles.sql` before `db:migrate`.
- Adding a domain = one `pgSchema`, one entry in `drizzle.config.ts`, grants
  in its first migration.
- The test reset (step 7) must set the sentinel inside its transaction to
  truncate `audit.events`.

## Related

- [new-project-directives.md §5](../new-project-directives.md)
- `scripts/db/setup-roles.sql`, `packages/db/src/client.ts`,
  `scripts/ci/check-migrations.ts`
