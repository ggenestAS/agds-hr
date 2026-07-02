Status: frozen

# People domain model

Date: 2026-07-02

## Context

The `people` product domain (bootstrap step 10) implements the imported "Albert
People" design: a directory over a job architecture, the annual review cycle,
calibration, compensation, and appeals. It is built in slices; this record pins
the foundational model landed in slice 1 (directory + job architecture) and the
decisions that constrain later slices.

## Decision

- **`people.employee` is HR attributes on a provisioned user**, not a second
  user record. One active row per `auth.user` (`user_id` unique among
  non-deleted), carrying `level`, `path`, `country`, `role_family`. Soft delete
  is the default (§5.3): `deleted_at`/`deleted_by`, a partial unique index on
  active rows, reads filter `isNull(deleted_at)`.
- **Job architecture is closed where bounded, open where not.** `CAREER_LEVELS`
  (four levels) and `CAREER_PATHS` (`ic`/`manager`) are `as const` tuples in
  `people/types.ts` driving the TS unions, pg enums, and Zod (§5.4). `country`
  and `role_family` are open `text` (the org adds families/countries without a
  migration). Level names are `L1..L4` placeholders, refinable to Albert's
  canonical ladder via a tuple edit + migration.
- **Bands and country coefficients are reference tables, unseeded, integer-typed.**
  `band` (`role_family` × `level` → `min/mid/max`, whole EUR `integer`) and
  `country_coefficient` (`country` → `coefficient_bp`, integer basis points where
  10000 = 1.00) hold real config entered later; slice 1 ships the schema, not
  values. Integers (not `numeric`) because Drizzle returns `numeric` as a string,
  which would surprise the slice-4 band-position math. Band position and rating
  are review/comp outputs — the directory shows them pending until slice 4.
- **Slice 1 DAL is `listDirectory` only.** Employee mutations (`upsertEmployee`)
  and band/coefficient reads land with the surfaces that call them, so every
  shipped export is exercised (the coverage gate is step 7, still pending). The
  `band`/`country_coefficient` schema lands now (it is the migration).
- **The manager graph stays in identity.** `identity.user_relationship`
  (`reports_to`) is the reporting line; `people.employee` does not duplicate it.
- **Reads run on the connection their columns require.** `listDirectory` joins
  `auth.user` (name/email — admin-only columns, §6.1), so it runs on the admin
  connection like `identity.listUsers`. `app_role`/`readonly_role` get SELECT on
  the `people` tables via migration grants.
- **HR product roles are deferred to the slice that gates on them.** `manager`,
  `lt_member`, `founder`, `admin` are added to the shared `USER_ROLES` enum (a
  pg-enum migration) by the review-cycle/comp slices — not now. Slice 1 gates
  `people.directory.read` to any authenticated staff and `people.employee.manage`
  to `developer` (charter's "domain roles beyond staff/developer" trigger fires
  per-slice).
- **Audit-of-reads is a slice-4 concern.** The design's "every read of
  compensation data is recorded" applies once comp figures exist; slice 1's
  directory read (names/levels, no salaries) is a normal read.

## Alternatives considered

- **A standalone people-user table** — Rejected: `auth.user` + `identity` already
  own identity; `employee` is attributes, not a parallel account.
- **Levels/paths/country/role_family all as pg enums** — Rejected: country and
  role_family are open vocabularies that must grow without migrations (§5.4);
  only the genuinely bounded sets (level, path) are enums.
- **Duplicate the manager line onto `employee`** — Rejected: two sources of truth
  for "who manages whom"; identity already owns the relationship graph.
- **Add all HR roles now** — Rejected: guesses the product's access model before
  the surfaces that need each role exist; added per-slice.

## Consequences

- Adding a role family or country is data, not a migration; adding a level/path
  edits the tuple and migrates the enum.
- The directory renders an empty state until employees are provisioned (no seed).
- Later slices extend this schema (review cases, comp records) and the role enum;
  the directory's Rating/Band columns light up when reviews land.

## Related

- [new-project-directives.md §5, §8, §17 step 10](../new-project-directives.md)
- [plans/people.md](../plans/people.md)
- [2026-07-02-auth-identity-session-and-policy.md](./2026-07-02-auth-identity-session-and-policy.md)
- `packages/domains/people/`
