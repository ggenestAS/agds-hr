Status: in progress
Readiness: ready

# people product domain plan

Bootstrap step 10 (new-project-directives.md §17) — the first product domain,
the "Albert People" surfaces from the imported design. Built in slices on the
identity/audit domain template. Model pinned in
[2026-07-02-people-domain-model.md](../decisions/2026-07-02-people-domain-model.md).

## Goal

Turn the frame's placeholders into the real HR surfaces: a people directory over
a job architecture, then the annual review cycle, calibration + founder sign-off,
compensation, and appeals — with the audit trail as a first-class product.

## Scope

### In (this slice — directory + job architecture)

- `@agds-hr/people` domain: `people` pgSchema with `employee` (HR attributes on
  a provisioned user: level, path, country, role family; soft-delete),
  `band` (role family × level → min/mid/max, France reference), and
  `country_coefficient` reference tables.
- Closed tuples `CAREER_LEVELS` (four levels) + `CAREER_PATHS` (`ic` / `manager`)
  with guards; `EmployeeId` in `@agds-hr/shared`.
- DAL: `listDirectory` only (admin connection — reads auth.user name/email).
  Employee mutations + band/coefficient reads land with their surfaces (every
  shipped export stays exercised; coverage gate is step 7).
- **Directory source: the Albert Inside roster.** `@agds-hr/inside` (a thin §8.3
  integration) fetches admin/officer staff from `GET /user/user-directory` with
  `X-API-Key` (`INSIDE_API_KEY`); `/people` renders that roster (name, email,
  title, campus, country, functional manager, active). `people.employee` holds
  agds-hr-native level/path and reconciles onto the roster in a later slice (by
  email/user_id); `listDirectory` (DB) is the future native path. Empty state
  when `INSIDE_API_KEY` is unset.
- `people.directory.read` policy (registered in the composition root); the
  server-fn triple; the `/people` route
  renders the real directory table (Person / Level·Path / Country / Band position
  / Rating) with an empty state — no demo data seeded.
- `requireSession` / `auditContext` server-fn helpers (§9.3).

### Out (later slices, with triggers)

- Review-cycle state machine (self-review → peer input → manager assessment →
  calibration → decision → appeal) — slice 2.
- Calibration + dual-founder sign-off, P6 auto-trigger, 30-day appeal clock — slice 3.
- Compensation (merit matrix, decision summary) + audit-of-reads on comp data — slice 4.
- Appeals (route to non-deciding founder, excluded from future performance views) — slice 5.
- HR product roles (`manager`, `lt_member`, `founder`, `admin`) — added to the
  shared role enum by the slice that first gates on them (charter trigger).

## Data model

- `people.employee`: `id`, `user_id` (FK auth.user, unique-active), `level`
  (`career_level` enum), `path` (`career_path` enum), `country` text,
  `role_family` text, `created_at`/`updated_at`, `deleted_at`/`deleted_by`.
- `people.band`: `id`, `role_family`, `level`, `min_eur`/`mid_eur`/`max_eur`,
  unique `[role_family, level]`.
- `people.country_coefficient`: `country` PK, `coefficient` numeric.
- Rating and band position are review/comp outputs (later slices); the directory
  shows them as pending until those land. The manager graph stays in
  `identity.user_relationship` (`reports_to`).

## Policies

`people.directory.read` — staff (any authenticated). `people.employee.manage` —
developer, until the HR admin role lands. Compensation-data read gating and the
audit-of-reads requirement arrive with slice 4.

## Surfaces

`/people` directory (Browse/List shape, §9.4) on the authenticated frame; empty
state until employees are provisioned. Person detail, review, calibration, comp,
and appeals surfaces are later slices.

## Open questions

- The four level names are `L1..L4` placeholders pending Albert's canonical
  ladder names (refinable — a tuple edit + migration).
- Band figures and country coefficients are entered later; no values are seeded.
