Status: planned
Readiness: stakeholder-pending

# notifications + cycle tracking plan

Who still owes what in the review cycle, and the email machinery that chases
it. Two deliverables that share one brain: a derived-obligations function
feeding (a) in-app tracking surfaces and (b) an email reminder system built as
a transactional outbox drained by cron.

Design settled in brainstorming (2026-07-04): event-driven emails + weekly
digest, manager and HR escalation, outbox over inline send (the charter's
deferred "transactional outbox" trigger fires here in miniature — Resend is an
external system observing writes).

## Goal

- Anyone with authority can answer "who still has to do what" from the app,
  live, without asking around: HR sees the whole campaign, managers see their
  reports, individuals see their own pending actions.
- People are chased automatically: immediate email when work lands on them,
  weekly digest while anything stays open, escalation to managers and HR.
- No second source of truth: obligations are computed from existing review
  state, never stored as tasks that can drift.

## Scope

### In

**1. Derived obligations (`@agds-hr/people`)**

- `computeObligations` — pure function over existing case state (review_case
  state, self_review.submitted_at, peer_request statuses, assessment
  submitted_at, sign-offs). Emits typed obligations:
  - `self_review_pending` → subject
  - `peer_input_pending` → requestee (per open peer_request)
  - `peer_quota_unmet` → subject + their manager (case stuck before
    manager_assessment)
  - `assessment_pending` → manager (case in manager_assessment, or
    assessment-ready and not started/submitted)
  - `sign_off_pending` → founders (case awaiting first or second sign-off)
- Each obligation carries subject, owner email, case id, cycle period, and
  `openSince` (for "pending N days" display).
- Manager resolution reuses the existing reporting-chain source (Inside
  roster / org-tree, as `/assessment` does today).
- One producer, three consumers: personal dashboard block, tracking board,
  digest job.

**2. Notification outbox (`@agds-hr/notifications`, new domain package)**

- `notifications` pgSchema, `outbox` table: `id`, `kind`, `recipient_email`,
  `payload` jsonb, `dedupe_key` text unique, `attempts` int default 0,
  `last_error` text, `sent_at`, `created_at`. Grants ship in the migration
  (`app_role` INSERT/SELECT/UPDATE; cron drains on the app connection).
- `enqueueNotification(tx, …)` — called inside the producing transaction.
  Duplicate `dedupe_key` is a silent no-op (`on conflict do nothing`): the
  obligation is already queued.
- Producers (event-driven, in the same transaction as the mutation they
  announce, alongside its `recordEvent`):
  - peer_request created → email requestee (`peer_request:{id}`)
  - case enters manager_assessment (peer quota met, advanced) → email manager
    (`assessment_ready:{caseId}`)
- Producer (scheduled): the weekly digest job (below) enqueues digest rows
  with `digest:{audience}:{email}:{iso-week}` — re-running the job is
  idempotent.
- Sending marks `sent_at` and records `notifications.outbox.sent` in the same
  transaction; failures increment `attempts` + `last_error`. After 5 attempts
  a row is abandoned (left unsent, visible by query; alerting is deferred).

**3. Cron (`packages/cron` + web route)**

- The package the Cloudflare hosting decision reserved. Job registry keyed by
  id; `apps/web` route `/api/cron/run/$jobId` guarded by `CRON_SECRET` bearer
  (constant-time compare, fail closed when the secret is unset). Cloudflare
  Cron Triggers in `wrangler.jsonc`.
- `drain-notifications` (every 5 min): claim pending outbox rows, render the
  email for each `kind`, send via **Resend** (pinned provider), mark sent.
  Missing `RESEND_API_KEY` fails the job — rows stay pending, nothing is
  silently dropped.
- `weekly-digest` (Mondays 07:00 UTC ≈ 08–09:00 Paris across DST): runs
  `computeObligations`; when no case is open, exits without enqueueing (no
  campaign = no email, by design, not by error). Otherwise enqueues:
  - individual digest — your own open items,
  - manager digest — open items among your direct + functional reports,
  - HR/admin digest — global completion counts by stage.

**4. Email rendering**

- Plain, factual templates per kind (subject + text/HTML body), rendered from
  the outbox payload at send time. From-address on the school domain (Resend
  domain verification is a one-time DNS setup, tracked as a task in the
  implementation plan). Links deep-link to the exact surface
  (`/peer-input/$requestId`, `/assessment/$caseId`, `/self-review`).
- No unsubscribe: these are compliance notices from an internal HR tool, not
  marketing. Stated deliberately.

**5. Tracking surfaces (`apps/web`)**

- `/tracking` — campaign board: per-person completion matrix (self review /
  peer inputs / assessment / sign-off), stage counts, filters (campus, team,
  stage), "pending N days" ageing. Visibility scoped by role: managers see
  their reports (direct + functional, as `/assessment` scopes), founders/
  admins/developers see everyone. Policy `people.tracking.read`.
- `/dashboard` — "Your pending actions" block: the viewer's own obligations
  with deep links, replacing guesswork about what's left.

### Out (with named triggers if deferred)

- **Cloudflare Queues** — trigger: outbox drain volume or latency makes the
  5-minute cron a bottleneck.
- **Deadline-driven reminders (J-7 / J-2 / overdue)** — trigger: campaign
  phases get configured per-cycle deadlines (today the cycle timeline is
  informational; there are no stored phase deadlines to key off).
- **Non-email channels (Slack, in-app inbox)** — trigger: email compliance
  proves insufficient after one full campaign.
- **Failure alerting on abandoned outbox rows** — trigger: first campaign
  surfaces actual send failures; until then abandoned rows are visible by
  query and on no surface.
- **Notification preferences / opt-out** — no trigger; compliance notices
  from an internal tool are not optional.
- **Reopened-review and campaign-kickoff event emails** — trigger: HR asks
  for them after the first campaign (kept out of v1 to hold event kinds to
  the two that unblock other people's work).

## Data model

- `notifications.outbox` as above. No new tables in `people`: obligations are
  derived, never stored.
- Outbox rows are operational, not the compliance record — the audit trail
  stays in `audit.events` (`notifications.outbox.sent`, plus the producing
  mutations' existing events). No soft delete; rows are append-then-update
  (`sent_at`/`attempts` only).

## Policies

- `people.tracking.read` — manager / founder / admin / developer; row scope
  (own reports vs everyone) enforced in the handler like `/assessment`.
- No read surface for the outbox in v1; the drain job runs on the app
  connection via the cron route's `CRON_SECRET` gate, not a user session.

## Surfaces

- `/tracking` (new, sidebar: Review cycle group, role-filtered).
- `/dashboard` pending-actions block (extends existing route).
- `/api/cron/run/$jobId` (machine-only).

## Open questions

- Digest send time is pinned to UTC (07:00), so Paris local time shifts an
  hour across DST — acceptable, or worth a timezone-aware schedule?
- Exact copy/branding of the email templates (plain text is fine to ship;
  HTML polish can follow).
