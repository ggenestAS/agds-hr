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

`people.directory.read` — any authenticated user. `people.employee.manage` —
developer/admin. Review flow: `people.review.open`/`.rate` — manager/founder/
developer; `people.review.advance` is per-target-state (`REVIEW_ADVANCE_ROLES`);
`people.decision.sign` — founder/developer. `people.comp.read` —
admin/founder/developer (the read is itself audited); `people.comp.manage` —
admin/developer. `people.appeal.file` — ALLOW (handler enforces
ownership + the 30-day window); `people.appeal.manage` — admin/developer.

## Surfaces

`/people` directory (Browse/List shape, §9.4) on the authenticated frame; empty
state until employees are provisioned. Person detail, review, calibration, comp,
and appeals surfaces are later slices.

## Built so far

- Slice 1 — directory + job architecture (schema, DAL, policy, route).
- Reconciliation — directory sourced from the Inside roster, merged with
  agds-hr level/path by email.
- Slice 2 — review-cycle state machine (`review_case`, guarded audited
  transitions, rating; directory Rating column).
- Slice 3 — person detail page (`/people/$userId`): Inside profile, editable
  level/path, functional reporting chain from Inside `/officer/org-tree`, and
  review-case Open/advance/rating controls.
- Slice D — stage-gated review authorization + HR product roles. Added
  `manager`/`founder`/`admin` to the role tuple and `identity.role`; the review
  flow's per-transition authority (`REVIEW_ADVANCE_ROLES`), rating authority, and
  sign-off/comp/appeal gates are now real roles rather than developer-only.
- Slice E — calibration + dual-founder sign-off. `/calibration` shows the rating
  distribution and the cases awaiting a decision; sign-off is guarded
  accumulation (unique `[case_id, founder_user_id]`), delivering only at two
  distinct sign-offs — which stamps `decided_at`, opens the 30-day
  `appeal_until` clock, sets `p6_triggered` when rating ≤ 2, and records
  `people.review.decision_delivered`.
- Slice F — compensation with audited reads. `comp_recommendation` (integer EUR),
  merit matrix (basis points) + band-position helpers; reading a recommendation
  writes `people.comp.viewed` in the SAME transaction as the SELECT (fail-closed
  audit-of-reads). Comp is leadership-only and revealed behind an explicit action.
- Slice G — appeals. `people.appeal` lives in its own table, never joined into
  review/comp/directory reads (structurally out of performance views). An
  appellant may appeal their OWN delivered decision within the 30-day window
  (ownership + clock enforced in the handler); appeals route to HR Admins because
  a dual-founder sign-off leaves no non-deciding founder. `/appeals` is the Admin
  queue (resolve with a recorded resolution); mutations audited
  (`people.appeal.filed` / `people.appeal.resolved`).

### Design import (Albert People.dc.html, slices H–P)

All 13 views of the imported design are implemented, wired to real data:

- H — shell + Overview: ink-900 grouped sidebar (Review cycle /
  Compensation / Governance, role-filtered); `/dashboard` Overview with stat
  tiles, the 2026 cycle timeline keyed to the viewer's own case, rating
  distribution (reviewers) or personal status (staff), needs-a-decision list.
  Design display metadata pinned in types: `CAREER_LEVEL_META`
  (Contributor/Owner/Lead/Head + level tests) and `REVIEW_RATING_LABELS`
  (Exceptional/Strong/Inconsistent/Not at level).
- I — `/compensation` (merit matrix from `MERIT_MATRIX_BP`, should-NOT-drive-pay,
  bonus rules) and `/bands` (bands + coefficients + phased transparency);
  `listBands`/`listCountryCoefficients`; coefficients seeded by migration
  (FR 1.00 / ES 0.85 / IT 0.92 / CH 1.35 in basis points).
- J — `/audit` (append-only trail behind the new `audit.log.read` policy;
  reading the log is not itself audited) and `/documentation` (delivered
  decisions with amounts + rationale; the whole page is ONE audited comp read
  via `listDecisionSummaries`).
- K — self-review: `self_review` table (validated string-map payload,
  `submitted_at`), audited save/submit/reopen; `/self-review` form (sections
  A–F, local draft autosave, send-to-manager). Ownership is structural: the
  case is looked up by the actor's email and auto-opened on first save.
  Objectives and KPIs are dynamic rows over pre-allocated key slots (2–6
  objectives, 0–5 KPIs, add/remove in the form); every long-form field carries
  a displayed min–max word target and a what-and-why help line. The submit
  gate (`selfReviewSubmitIssues`, pure and shared) enforces the minimum
  complete objectives, no half-filled rows, and word bounds on filled fields —
  the form disables Send on any issue and the server re-checks (fail closed);
  draft saves are never gated. Name, role, manager, and period are server-
  resolved context (`REVIEW_CYCLE_PERIOD_LABEL` + Inside roster + employee
  attrs) — displayed read-only and stamped into the payload on save/submit.
- L — peer input: `peer_request` table (named, one per requestee per case,
  decline-with-reason); `/peer-input` with requestee answer/decline flows and
  the reviewer panel (case chips, quota pills, requestee picker, submitted
  input — the actor's own case structurally excluded). The LT gate
  (`isPeerQuotaMet`: 2 LT + 2 own-team SUBMITTED) blocks
  peer_input → manager_assessment in the advance handler.
- M — assessment: `assessment` table (per-dimension score/narrative/evidence,
  proposed rating, promo flag, comp TYPE, P6 ack); `/assessment` with the
  evidence-gated submit (pure `canSubmitAssessment`, enforced in the DAL);
  submitting writes the case rating.
- N — `/sign-off`: decision queue with per-founder pills + decision-summary
  panel; comp amounts stay behind the audited `compFn` read.
- O — employee record: dark hero + tabs (Evaluation with the job-architecture
  ladder and assessed dimensions; Review with the state controls, self-review,
  assessment proposal, appeal; Compensation; History timeline).
- P — directory (country chips, ladder names, rating chips), calibration
  grouped by level, and `/appeals` as one surface (own appeal + windowed submit
  form for everyone; HR queue + written resolution for Admins).
- Q — employment types + review participation
  ([ADR](../decisions/2026-07-03-employment-types-and-review-participation.md)).
  `employment_type` enum on `employee` (`employee` default; apprentice / VIE /
  intern / freelance) with two DERIVED policies: `isSalaryBandApplicable`
  (employee only) and `participatesInReview` (employee default + tri-state
  `review_participation_override` for exceptions — today, reviewed
  freelancers). `openCase` fails closed (`not_in_review_cycle`) for
  non-participants; HR admins edit type + override on the person page; the
  directory and person hero show non-employee types and their band/review
  status.

Remaining: seed band figures and canonical ladder names if they differ from the
design's; surface band-position and merit suggestion once people have
role_family and bands (helpers exist — gate the math on
`isSalaryBandApplicable`, ADR); wire the `lt_member` role (deferred) into
calibration authority if the design calls for it.

## Open questions

- The four level names are `L1..L4` placeholders pending Albert's canonical
  ladder names (refinable — a tuple edit + migration).
- Band figures and country coefficients are entered later; no values are seeded.
