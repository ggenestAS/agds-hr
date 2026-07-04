Status: frozen

# Notifications outbox and derived obligations

Date: 2026-07-04

## Context

The review cycle needs two things at once: an authoritative answer to "who
still has to do what" and email machinery that chases the laggards without a
human doing it. Tasks stored as rows drift from the review state they mirror;
emails sent inline from request handlers are lost when the send fails after
the commit (or worse, sent when the transaction rolls back). The charter had
already named "transactional outbox" as a deferred trigger for the first
external system observing our writes — Resend is that system.

## Decision

- **Obligations are derived, never stored.** `computeObligations`
  (`packages/domains/people/src/obligations.ts`) is a pure function over
  existing case state (review state, self-review submission, peer-request
  statuses, quota, sign-offs) emitting five typed obligation kinds with
  owner, subject, case id, and `openSince`. One producer, three consumers:
  the `/tracking` board, the dashboard "Your pending actions" block, and the
  weekly digest job — they can never disagree because they share the brain.
- **Emails go through a transactional outbox.** `notifications.outbox`
  (new `@agds-hr/notifications` domain) is written by `enqueueNotification`
  inside the same transaction as the mutation it announces, alongside its
  `recordEvent`. A unique `dedupe_key` with `on conflict do nothing` makes
  every producer idempotent (event kinds key off entity ids; digests key off
  `digest:{audience}:{email}:{iso-week}`).
- **Cron drains the outbox; sending is fail-closed.** `drain-notifications`
  (every 5 min) claims pending rows, renders per-kind templates, sends via
  Resend, marks `sent_at` and records `notifications.outbox.sent` — audited
  under a fixed `SYSTEM_ACTOR_ID`. Failures increment `attempts` +
  `last_error`; after 5 attempts the row is abandoned but visible by query.
  Missing `RESEND_API_KEY` fails the job and leaves rows pending;
  `EMAIL_DRY_RUN` defaults to true so no environment emails by accident.
- **Two invocation paths, one job registry.** `packages/cron` is a pure
  registry; jobs are defined in `apps/web/src/server/cron.server.ts` where
  the app context lives. Cloudflare Cron Triggers hit the Worker `scheduled()`
  handler; `/api/cron/run/$jobId` allows manual runs behind a `CRON_SECRET`
  bearer with constant-time compare — unset secret answers 503 (fail closed).
- **Event emails are held to the two that unblock other people's work:**
  peer request created (requestee) and assessment ready (manager). Everything
  else is the Monday digest (individual / manager / HR audiences), which
  exits without enqueueing when no case is open — no campaign means no email,
  by design.
- **Tracking is a read surface over the same derivation.** Policy
  `people.tracking.read` (manager and up); row scope mirrors `/assessment`
  (managers see their reports at any depth, leadership sees everyone),
  enforced in the handler.

## Alternatives considered

- **Stored task rows** — Rejected: a second source of truth that drifts the
  moment a case advances outside the task writer's path.
- **Inline send in request handlers** — Rejected: not atomic with the
  mutation; a Resend outage would either lose the notice or block the write.
- **Cloudflare Queues** — Deferred, named trigger: drain volume or latency
  makes the 5-minute cron a bottleneck. The outbox table is the durable part;
  the transport can change without touching producers.
- **Per-user notification preferences** — Rejected: these are compliance
  notices from an internal HR tool, not marketing; no opt-out.

## Consequences

- Every future mutation that creates work for someone else enqueues in the
  same transaction — the pattern is `recordEvent` + `enqueueNotification`,
  both or neither.
- Re-running any producer or the digest job is safe; idempotency lives in the
  database (`dedupe_key`), not in job bookkeeping.
- Abandoned rows (5 failed attempts) have no surface yet; the named trigger
  for alerting is the first campaign surfacing real send failures.
- Deadline-driven reminders (J-7 / J-2 / overdue) stay out until campaign
  phases carry stored deadlines.

## Related

- [plans/notifications.md](../plans/notifications.md)
- [2026-07-03-cloudflare-hosting.md](./2026-07-03-cloudflare-hosting.md)
  (reserved `packages/cron`, Cron Triggers)
- `packages/domains/people/src/obligations.ts`,
  `packages/domains/notifications/`, `packages/integrations/resend/`,
  `packages/cron/`, `apps/web/src/server/cron.server.ts`,
  `apps/web/src/server/obligations.server.ts`, migration
  `20260703222958_notifications-outbox`
