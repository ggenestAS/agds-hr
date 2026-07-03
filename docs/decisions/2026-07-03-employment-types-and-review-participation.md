Status: frozen

# Employment types and review participation

Date: 2026-07-03

## Context

Not everyone on the roster is a salaried employee. Apprentices, VIE, and
interns are not subject to salary bands; freelancers are outside the bands too
(they invoice day rates), and only SOME freelancers go through the annual
review. The people domain needed a way to say who the band and review
machinery applies to — without per-population flags multiplying.

## Decision

- **Model policies, not populations.** The requirement arrived as "apprentices
  are X, freelancers are Y"; what the system enforces are two independent
  policies — `subject_to_salary_band` and `participates_in_review` — derived
  from one `employment_type` enum (`employee` | `apprentice` | `vie` |
  `intern` | `freelance`, closed tuple in `people/types.ts` per §5.4).
  `employee` means salaried CDI/CDD; splitting CDI/CDD is deferred until a
  policy treats them differently.
- **Band applicability is a pure function, never a column.**
  `isSalaryBandApplicable(type)` is true only for `employee`. A stored boolean
  next to the type would be a second source of truth that drifts; the rule is
  pinned by unit tests instead.
- **Review participation is the type default plus one tri-state override.**
  `participatesInReview(type, override)`: `employee` participates by default,
  everyone else is opt-in via `review_participation_override`
  (`included` | `excluded` | NULL = follow the type default). The column is
  named after the policy it controls, not a population — today it is only set
  for freelancers, but the mechanism is population-agnostic.
- **Fail closed at the case-open choke point.** `openCase` (the DAL) rejects
  non-participants with `conflict: not_in_review_cycle`, so every entry point
  (reviewer open, self-review auto-open) hits the same gate. A wrongly-skipped
  review is visible and recoverable; non-participants polluting managers'
  queues erode trust in the cycle.
- **Absent employee record reads as `employee`.** The Inside roster cannot
  distinguish these types (`officer.external` is too coarse), so HR maintains
  the type in agds-hr on the employee record; people without a record keep the
  status-quo behavior (participating, band-governed) and the gate only bites
  once HR marks an exception. Migration backfills existing rows with the
  `employee` default.
- **Cycles snapshot at open; bands read the current type.** A case that was
  legitimately opened stays open if the type later changes (the case is the
  compliance record); band applicability is evaluated against the person's
  current type wherever it is displayed.

## Alternatives considered

- **A `freelance_reviewed` boolean** — Rejected: names a population, so the
  next exception (a VIE needing a review) means another flag; the tri-state
  override covers all populations with one mechanism.
- **A stored `band_applicable` column** — Rejected: derivable from the type;
  a second source of truth that drifts when the type changes.
- **Deriving the type from Inside's `external` flag** — Rejected: `external`
  cannot distinguish apprentice / VIE / intern / freelance; HR owns the data
  in agds-hr (manual, on the employee edit surface).
- **Default participation for apprentices/VIE too** — Rejected by the
  founders: the default review population is salaried employees only; all
  other types opt in explicitly.

## Consequences

- Freelancers who are reviewed get `review_participation_override =
'included'`; nothing else changes for them.
- `upsertEmployeeByEmail` now writes type + override (audited in the same
  transaction, as before); the person page shows the type, review-cycle and
  band status, and lets HR admins edit both fields.
- Future band-position surfaces must call `isSalaryBandApplicable` before
  doing band math for a person.

## Related

- [plans/people.md](../plans/people.md)
- [2026-07-02-people-domain-model.md](./2026-07-02-people-domain-model.md)
- `packages/domains/people/src/types.ts`, `review.ts` (`openCase` gate),
  migration `20260703082956_people-employment-type`
