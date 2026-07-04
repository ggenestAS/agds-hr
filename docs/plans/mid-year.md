Status: in progress
Readiness: ready

# mid-year check-in (P5) plan

P5 in the process handbook (performance-evaluation-and-compensation-process.md)
is the January/February course-correction: a 30–60 min meeting per direct
report, ending in a filed one-paragraph summary plus three routed flags (P1
verification, promotion candidacy, underperformance → P6 early door). Until
now the handbook marked it "not implemented — summaries and flags are filed
outside the app". This module makes agds-hr the filing cabinet.

## Goal

Managers file the mid-year written output in-app: status (priorities on track / off
track), the one-paragraph summary, master-record verification, and the two flags —
audited, submit-gated (fail closed), scoped to the manager graph. **Filing opens
January 1 and closes January 31 (Europe/Paris)**; outside the window, filed records
stay readable and new writes are blocked server-side.

## Scope

### In

- `people.check_in` table: one row per subject per period, keyed by email like
  every people-domain record. Draft save + final submit (submit is final, like
  the assessment — no reopen).
- Pure submit gate `checkInSubmitIssues` (shared, unit-tested): status chosen,
  summary carries a minimum word count, unconfirmed P1 requires a note, each
  raised flag requires its note.
- Policy `people.checkin.write` (manager / founder / admin / developer);
  row scope enforced in the handler via the manager graph (either reporting
  line, any depth) with the leadership roster fallback — same rule as
  `/assessment`.
- `/mid-year` route (REVIEWERS nav, Review cycle group): the viewer's reports
  with check-in status, inline draft/submit form.
- Handbook update: P5 coverage flips to "Yes"; the meeting itself and the
  routing of flags into P1 edits / P6 plans remain manual obligations.

### Out (with named triggers)

- Notifications / obligations integration (nudge managers in the window) —
  trigger: first January window with the module live.
- Structured routing of flags (auto-open P6 early-door records, P1 diffs) —
  trigger: a P6 improvement-plan table exists.
- Subject visibility of the filed summary — trigger: leadership decides at P9
  that check-in records are shared with the person (today they are a
  management filing, reviewer-and-up only, like peer input).

## Data model

`people.check_in`: `id`, `subject_email`, `period` (text, `"2027"` — the
review cycle the check-in feeds), `status` (`check_in_status` enum: on_track /
off_track), `summary` text, `p1_confirmed` boolean + `p1_note`, `promo_flag`
boolean + `promo_note`, `underperf_flag` boolean + `underperf_note`,
`author_email`, `submitted_at`, timestamps. Unique `[subject_email, period]`.
No soft delete — like `review_case`, the record is the point.

## Policies

`people.checkin.write` — manager/founder/admin/developer; the handler enforces
manager-graph scope per subject and no self-check-in. Reads use the same
policy (the surface is the write surface).

## Surfaces

`/mid-year` — reports list (direct first, then indirect; leadership sees the
roster when they manage no one), per-person form, filed records read-only.

## Open questions

- Should the subject see their filed summary? Deferred (see Out) — the
  handbook files it without specifying employee visibility; P9 owns the call.
