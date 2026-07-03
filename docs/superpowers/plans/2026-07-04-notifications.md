# Notifications + Cycle Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derived review-cycle obligations feeding a tracking board, a dashboard pending-actions block, and an email reminder system (transactional outbox drained by cron, sent via Resend).

**Architecture:** A pure `computeObligations` in `@agds-hr/people` is the single brain. A new `@agds-hr/notifications` domain owns the `notifications.outbox` table; producers enqueue inside the same transaction as the mutation (like `recordEvent`). `packages/cron` is a pure job registry; job definitions live in `apps/web/src/server/cron.server.ts` (the composition root). Cloudflare Cron Triggers invoke a `scheduled` handler in `src/server.ts`; a bearer-guarded `/api/cron/run/$jobId` route runs the same registry manually.

**Tech Stack:** Bun, Drizzle on Neon, TanStack Start on Cloudflare Workers, Resend (raw fetch), bun:test.

**Spec:** `docs/plans/notifications.md`. One correction to it (Task 10): producers run on the admin connection (people DAL convention), so outbox grants go to `admin_role` (and `app_role` for symmetry), not app-only.

---

### Task 1: `computeObligations` (pure, people domain)

**Files:**

- Create: `packages/domains/people/src/obligations.ts`
- Create: `packages/domains/people/src/obligations.test.ts`
- Modify: `packages/domains/people/src/index.ts` (barrel exports)

- [ ] **Step 1: Write the failing test** (`obligations.test.ts`, plain unit — no `[integration]` tag)

Cases to cover: self_review state w/o submission → `self_review_pending` owned by subject; pending peer request → `peer_input_pending` owned by requestee with `openSince` = request createdAt; peer_input state with quota unmet → `peer_quota_unmet` owned by subject AND each manager; manager_assessment w/o submitted assessment → `assessment_pending` per manager; decision state w/ signoffCount < 2 → `sign_off_pending` per founder; decided case → no obligations; submitted everything → no obligations.

- [ ] **Step 2: Run** `bun test packages/domains/people/src/obligations.test.ts` — expect FAIL (module not found).

- [ ] **Step 3: Implement** `obligations.ts`:

```ts
import {
  isPeerQuotaMet,
  type PeerKind,
  type PeerRequestStatus,
  type ReviewState,
} from "./types.ts";

// The single brain for "who still has to do what" (docs/plans/notifications.md):
// obligations are DERIVED from case state, never stored, so they cannot drift.
// Consumed by the tracking board, the dashboard pending block, and the weekly
// digest job. Pure — the caller assembles inputs from the DALs.
export const OBLIGATION_KINDS = [
  "self_review_pending",
  "peer_input_pending",
  "peer_quota_unmet",
  "assessment_pending",
  "sign_off_pending",
] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];

export type Obligation = {
  readonly kind: ObligationKind;
  readonly ownerEmail: string; // who must act (lowercase)
  readonly subjectEmail: string; // whose case it is (lowercase)
  readonly caseId: string;
  readonly cyclePeriod: string;
  readonly openSince: Date | undefined;
};

export type ObligationCaseInput = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly cyclePeriod: string;
  readonly state: ReviewState;
  readonly decided: boolean;
  readonly caseCreatedAt: Date | undefined;
  readonly selfSubmittedAt: Date | undefined;
  readonly peerRequests: readonly {
    readonly requesteeEmail: string;
    readonly kind: PeerKind;
    readonly status: PeerRequestStatus;
    readonly createdAt: Date;
  }[];
  readonly peerQuota: Readonly<Partial<Record<PeerKind, number>>>;
  readonly assessmentSubmittedAt: Date | undefined;
  readonly signoffCount: number;
  readonly managerEmails: readonly string[]; // subject's direct managers, both lines
};

export function computeObligations(
  cases: readonly ObligationCaseInput[],
  founderEmails: readonly string[],
): readonly Obligation[] {
  const obligations: Obligation[] = [];
  for (const c of cases) {
    if (c.decided || c.state === "closed") continue;
    const subject = c.subjectEmail.toLowerCase();
    const base = { subjectEmail: subject, caseId: c.caseId, cyclePeriod: c.cyclePeriod };
    if (c.state === "self_review" && c.selfSubmittedAt === undefined) {
      obligations.push({
        kind: "self_review_pending",
        ownerEmail: subject,
        openSince: c.caseCreatedAt,
        ...base,
      });
    }
    for (const r of c.peerRequests) {
      if (r.status === "pending") {
        obligations.push({
          kind: "peer_input_pending",
          ownerEmail: r.requesteeEmail.toLowerCase(),
          openSince: r.createdAt,
          ...base,
        });
      }
    }
    if (c.state === "peer_input" && !isPeerQuotaMet(c.peerRequests, c.peerQuota)) {
      for (const owner of [subject, ...c.managerEmails.map((e) => e.toLowerCase())]) {
        obligations.push({
          kind: "peer_quota_unmet",
          ownerEmail: owner,
          openSince: c.caseCreatedAt,
          ...base,
        });
      }
    }
    if (c.state === "manager_assessment" && c.assessmentSubmittedAt === undefined) {
      for (const manager of c.managerEmails) {
        obligations.push({
          kind: "assessment_pending",
          ownerEmail: manager.toLowerCase(),
          openSince: c.caseCreatedAt,
          ...base,
        });
      }
    }
    if (c.state === "decision" && c.signoffCount < 2) {
      for (const founder of founderEmails) {
        obligations.push({
          kind: "sign_off_pending",
          ownerEmail: founder.toLowerCase(),
          openSince: c.caseCreatedAt,
          ...base,
        });
      }
    }
  }
  return obligations;
}
```

(Exact emission rules may be refined while writing tests; the test file is the specification.)

- [ ] **Step 4: Run the test — PASS.** Also export from `index.ts`: `computeObligations`, `OBLIGATION_KINDS`, types `Obligation`, `ObligationKind`, `ObligationCaseInput`.

- [ ] **Step 5: Commit** `feat(people): derive review-cycle obligations from case state`

---

### Task 2: `@agds-hr/notifications` domain package

**Files:**

- Create: `packages/domains/notifications/package.json`, `tsconfig.json`
- Create: `packages/domains/notifications/src/db/schema.ts`, `src/dal.ts`, `src/templates.ts`, `src/index.ts`
- Create: `packages/domains/notifications/src/templates.test.ts`, `src/dal.test.ts` (`[integration]`)
- Modify: root `tsconfig.json` (paths for `@agds-hr/notifications` + `/db/schema`)

- [ ] **Step 1: Package scaffold** — copy people's `package.json` shape (name `@agds-hr/notifications`; deps: audit, db, shared, drizzle-orm beta; exports `.` and `./db/schema`). tsconfig extends base, include src.

- [ ] **Step 2: Schema** (`db/schema.ts`):

```ts
import { integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Transactional outbox for email notifications (docs/plans/notifications.md,
// ADR 2026-07-04). Producers enqueue INSIDE the producing transaction (like
// recordEvent); the drain cron sends via Resend. `dedupe_key` unique makes
// enqueue idempotent. Rows are operational, not the compliance record — the
// audit trail stays in audit.events. Kind is an open dotted vocabulary (§5.4).
export const notificationsSchema = pgSchema("notifications");

export const outbox = notificationsSchema.table("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  payload: jsonb("payload").notNull().default({}),
  dedupeKey: text("dedupe_key").notNull().unique("outbox_dedupe_key"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: DAL** (`dal.ts`): `EnqueueNotificationInput { kind, recipientEmail, payload: Record<string, unknown>, dedupeKey }`; `enqueueNotification(executor: DrizzleExecutor, input)` — insert `onConflictDoNothing` (silent no-op on duplicate dedupe key); `MAX_SEND_ATTEMPTS = 5`; `listPendingNotifications(db, limit = 50)` — `sentAt IS NULL AND attempts < MAX`, oldest first; `markNotificationSent(db: DrizzleDb, id, context: AuditContext)` — sets `sentAt = now()` + `recordEvent` (`domain: "notifications"`, `eventType: "notifications.outbox.sent"`, `resourceId: id`) in one transaction; `markNotificationFailed(db: DrizzleDb, id, error: string, context)` — `attempts + 1`, `lastError`, audited as `notifications.outbox.failed`.

- [ ] **Step 4: Templates** (`templates.ts`): `APP_BASE_URL = "https://hr.albertschool.com"` (code is the system of record). `renderNotification(kind: string, payload: Record<string, unknown>): { subject: string; text: string }` — switch over kinds `"peer_request.created"` (to requestee: who it's about + link `/peer-input`), `"assessment.ready"` (to manager: subject ready + link `/assessment/{caseId}`), `"digest.individual"` / `"digest.manager"` (payload `{ items: { kind, subjectEmail }[] }`, human line per item + link `/dashboard` or `/tracking`), `"digest.hr"` (payload `{ total, counts }`). Unknown kind **throws** `Error("unknown_notification_kind: ...")` — fail closed, a row we can't render stays pending and surfaces via attempts. Plain factual text; no HTML in v1 (spec).

- [ ] **Step 5: Tests.** `templates.test.ts` (unit): each kind renders subject+text containing the deep link; unknown kind throws. `dal.test.ts` (`[integration]`, `describe.skipIf(!sentinelSet)` like `review.test.ts`): enqueue twice with same dedupeKey → one row; listPending excludes sent and exhausted rows; markSent stamps + audits; markFailed increments.

- [ ] **Step 6: Barrel + root tsconfig paths.** Run `bun install` (workspace link), `bun run lint`.

- [ ] **Step 7: Commit** `feat(notifications): outbox domain package with templates`

---

### Task 3: Migration (schema + grants)

- [ ] **Step 1:** Append `"packages/domains/notifications/src/db/schema.ts"` to `drizzle.config.ts` schema array.
- [ ] **Step 2:** `bun run db:generate -- --name notifications-outbox` (creates `packages/db/migrations/<ts>_notifications-outbox/`). Do NOT touch snapshot.json.
- [ ] **Step 3:** Hand-append grants to the generated `migration.sql` (the normal path per AGENTS.md):

```sql
--> statement-breakpoint
GRANT USAGE ON SCHEMA "notifications" TO app_role, admin_role, readonly_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "notifications"."outbox" TO "admin_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "notifications"."outbox" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "notifications"."outbox" TO "readonly_role";
```

(No DELETE anywhere: rows are append-then-update. Producers and the drain run on the admin connection — people mutations already do.)

- [ ] **Step 4:** `bun run db:migrate`, then `bun run check:migrations`.
- [ ] **Step 5: Commit** `feat(db): notifications.outbox migration with grants`

---

### Task 4: Resend integration + env

**Files:**

- Create: `packages/integrations/resend/package.json`, `tsconfig.json`, `src/client.ts`, `src/client.test.ts`, `src/index.ts`
- Modify: `packages/env/src/manifest.ts`, `.env.example`, root `tsconfig.json`

- [ ] **Step 1:** Client mirrors `@agds-hr/inside`'s shape: `isResendConfigured(env)` (RESEND_API_KEY set); `isEmailDryRun(env)` — **dry-run unless `EMAIL_DRY_RUN === "false"`** (fail closed: no accidental production email from dev); `sendTransactional({ to, subject, text }, { env, fetchImpl })` — dry-run logs and returns `{ id: undefined, dryRun: true }`; live path raw `fetch` POST `https://api.resend.com/emails` with `Authorization: Bearer`, `from: EMAIL_FROM_ADDRESS` constant (`"Albert People <people@albertschool.com>"` — requires one-time Resend DNS verification, noted in `.env.example`), 10s `AbortSignal.timeout`, non-2xx throws `Error("resend_send_failed: <status>")`.
- [ ] **Step 2:** Unit tests with injected `fetchImpl` fake: dry-run never calls fetch; live path posts correct body; non-2xx throws; unset key throws `resend_not_configured`.
- [ ] **Step 3:** ENV_MANIFEST additions (all `scope: "server"`): `RESEND_API_KEY` (owner `@agds-hr/resend`, group `email`, optional), `EMAIL_DRY_RUN` (same, optional), `CRON_SECRET` (owner `@agds-hr/web`, group `cron`, optional). `.env.example` gets commented paragraphs for both groups. Run `bun run check:env` — must pass.
- [ ] **Step 4: Commit** `feat(resend): transactional email client with fail-closed dry-run`

---

### Task 5: Event producers (people domain)

**Files:**

- Modify: `packages/domains/people/src/peer-input.ts` (createPeerRequests, approvePeerRequest)
- Modify: `packages/domains/people/src/review.ts` (advanceCase)
- Modify: `packages/domains/people/package.json` (+ `@agds-hr/notifications`)
- Modify: `apps/web/src/server/people.impl.server.ts` (advanceReviewHandler)

- [ ] **Step 1:** `createPeerRequests` — inside the existing transaction, select the case's `subjectEmail`, then for each entry `enqueueNotification(tx, { kind: "peer_request.created", recipientEmail: entry.email.toLowerCase(), payload: { subjectEmail, caseId }, dedupeKey: \`peer_request.created:${caseId}:${email}\` })`.
- [ ] **Step 2:** `approvePeerRequest` — extend the status select with `caseId`, `requesteeEmail` + a join for `subjectEmail`; enqueue the same kind with the same dedupe-key shape (idempotent across both creation paths).
- [ ] **Step 3:** `advanceCase` gains an optional last-but-one param `notifications: readonly EnqueueNotificationInput[] = []`, enqueued inside its transaction after `recordEvent`.
- [ ] **Step 4:** `advanceReviewHandler` — when `toState === "manager_assessment"`, resolve the subject's manager emails from the Inside roster (functional `managementChain(...)[0]` + local manager node, as `personDetailHandler` does; best-effort empty on Inside failure) and pass `kind: "assessment.ready"` inputs (`payload: { subjectEmail, caseId }`, `dedupeKey: \`assessment.ready:${caseId}:${managerEmail}\``).
- [ ] **Step 5:** Extend the `[integration]` peer-input/review tests: creating a peer request lands an outbox row; duplicate create is one row. `bun run lint` + targeted tests.
- [ ] **Step 6: Commit** `feat(people): enqueue notifications with peer-request and assessment-ready mutations`

---

### Task 6: `packages/cron` registry

**Files:**

- Create: `packages/cron/package.json`, `tsconfig.json`, `src/registry.ts`, `src/iso-week.ts`, `src/registry.test.ts`, `src/iso-week.test.ts`, `src/index.ts`
- Modify: root `tsconfig.json` paths

- [ ] **Step 1:** Registry (pure, no IO): `type CronJob = { readonly id: string; readonly run: () => Promise<Record<string, unknown>> }`; `registerCronJob(job)` (duplicate id throws `Error("cron_job_already_registered: ...")`); `getCronJob(id): CronJob | undefined`; `listCronJobIds()`; `__resetCronRegistryForTests()`.
- [ ] **Step 2:** `isoWeekKey(date: Date): string` → `"2026-W27"` (ISO-8601 week, UTC) — the digest dedupe component. Unit-test year boundaries (Jan 1 landing in W52/W53 of prior year; Dec 29 landing in W01).
- [ ] **Step 3:** Commit `feat(cron): job registry and iso-week helper`

---

### Task 7: Cron jobs + web wiring

**Files:**

- Create: `apps/web/src/server/obligations.server.ts` (shared assembly)
- Create: `apps/web/src/server/cron.server.ts` (job definitions + HTTP handler)
- Modify: `apps/web/src/server.ts` (route + `scheduled` handler)
- Modify: `apps/web/wrangler.jsonc` (`triggers.crons`)
- Modify: `apps/web/package.json` (+ cron, notifications, resend deps)

- [ ] **Step 1: Assembly** (`obligations.server.ts`): `collectCycleObligations(adminDb)` → `{ obligations, caseInputs, managersBySubject, founderEmails, adminEmails, rosterNameByEmail }`. Builds `ObligationCaseInput[]` for `REVIEW_CURRENT_CYCLE` from `listCasesForCycle` + `listSelfReviewsByCases` + `listPeerRequestsForCases` + per-case `getAssessmentByCase`/`getSignoffs`, manager emails per subject from the Inside roster/org-tree (best-effort, like `loadInsideDirectory`), peer quota via `resolvePeerInputQuota` logic, founders/admins from `listUsers` roles. Used by the digest job AND the tracking handler (one brain, spec).
- [ ] **Step 2: Jobs** (`cron.server.ts`): `registerCronJobs()` idempotent. `SYSTEM_ACTOR_ID` constant UUID + fresh `RequestId` per run for the audit context (documented: cron has no session).
  - `drain-notifications`: `listPendingNotifications` → for each: `renderNotification`, `sendTransactional`, `markNotificationSent`; catch per-row → `markNotificationFailed`. If not dry-run and `!isResendConfigured()` → throw (rows stay pending, nothing dropped). Returns `{ sent, failed }`.
  - `weekly-digest`: `collectCycleObligations`; zero obligations → `{ skipped: true }`. Enqueue with `dedupeKey` `digest.<audience>:<email>:<isoWeekKey(now)>`: per owner (`digest.individual`, their items), per manager (`digest.manager`, items whose subject is one of their reports and owner ≠ manager), per admin/founder (`digest.hr`, counts by kind + total). Returns `{ enqueued }`.
- [ ] **Step 3: HTTP handler** (`cron.server.ts`): `handleCronRequest(request)` — extract jobId from `/api/cron/run/<jobId>`; `CRON_SECRET` unset → 503 `cron_secret_unset` (fail closed); bearer compared with `crypto.timingSafeEqual` (length-guarded) → 401 on mismatch; unknown job → 404; run → 200 JSON result, error → 500 with message.
- [ ] **Step 4: `server.ts`**: route `pathname.startsWith("/api/cron/run/")` → lazy-import `cron.server.ts` (keeps the worker entry slim) inside `runWithRequestDbScope`. Add `scheduled(controller, env, ctx)` to the default export: `applyWorkerEnv(env)`; map `controller.cron` `"*/5 * * * *"` → `drain-notifications`, `"0 7 * * 1"` → `weekly-digest`; `ctx.waitUntil(runWithRequestDbScope(...))`.
- [ ] **Step 5: `wrangler.jsonc`**: `"triggers": { "crons": ["*/5 * * * *", "0 7 * * 1"] }` with the why-comment (Mon 07:00 UTC digest — accepted DST drift, spec open question).
- [ ] **Step 6:** `bun run lint` + `bun run build` must pass. Commit `feat(web): cron runner, drain and weekly-digest jobs, cloudflare triggers`

---

### Task 8: Tracking policy + handlers

**Files:**

- Modify: `packages/domains/people/src/policies.ts` (+ `canViewTracking`), `src/index.ts`, `src/policies.test.ts`
- Modify: `apps/web/src/server/policies.ts` (register `people.tracking.read`)
- Modify: `apps/web/src/server/people.shared.ts` (TrackingView types), `people.functions.ts` (`trackingFn`), `people.impl.server.ts` (`trackingHandler`, extend `overviewHandler`)

- [ ] **Step 1:** `canViewTracking(user)` — ALLOW for `manager`/`founder`/`admin`/`developer`, else `DENY("manager_required")`. Unit test both branches. Register in the composition root.
- [ ] **Step 2:** `trackingHandler()` — `requireSession("people.tracking.read")`; `collectCycleObligations`; scope: leadership sees all subjects, managers only `managed.all`; build `TrackingRow` per case: subject (email/name/userId), state, `selfSubmitted`, `peersSubmitted`/`peersPending`/`quotaMet`, `assessmentSubmitted`, `signoffCount`, `decided`, plus that subject's open obligations with `openDays` (floor((now − openSince)/86400000)). Return `{ cycle, rows, counts }` where `counts` is per-state totals.
- [ ] **Step 3:** `overviewHandler` gains `myPending: readonly { kind, subjectEmail, caseId, openDays }[]` — the viewer's own obligations (owner === subject email) from the same assembly.
- [ ] **Step 4:** `bun run lint`; commit `feat(web): tracking handler and dashboard pending obligations`

---

### Task 9: UI — `/tracking` board + dashboard block + nav

**Files:**

- Create: `apps/web/src/routes/_app.tracking.tsx`
- Modify: `apps/web/src/routes/_app.dashboard.tsx` ("Your pending actions" block)
- Modify: `apps/web/src/components/frame.tsx` (nav entry `{ to: "/tracking", label: "Tracking", roles: REVIEWERS }` in Review cycle group)

- [ ] **Step 1:** `_app.tracking.tsx` — Browse shape: loader → `trackingFn`; stage-count stat chips; completion matrix table (Person / State / Self / Peers / Assessment / Sign-offs / Pending, with "N d" ageing); URL-driven `state` filter + debounced search (`validateSearch` + Zod per §9.2); rows link to `/people/$userId`. Empty state when no cases. In-page denial branch is unnecessary (route is nav-gated + policy throws like `/calibration`; follow that route's pattern).
- [ ] **Step 2:** Dashboard block: when `myPending` non-empty, a list of pending items, each a real `<Link>` to its surface (`self_review_pending` → `/self-review`, `peer_input_pending` → `/peer-input`, `assessment_pending`/`peer_quota_unmet` → `/assessment`, `sign_off_pending` → `/sign-off`). No card wrapper unless dashboard tiles already use one — match the existing dashboard tile primitives.
- [ ] **Step 3:** `bun run check:nav`, `bun run check:client-barrels`, `bun run lint`, `bun run build`, mobile-width sanity (375px).
- [ ] **Step 4: Commit** `feat(web): tracking board and dashboard pending-actions block`

---

### Task 10: Docs + drift fixes

- [ ] **Step 1:** ADR `docs/decisions/2026-07-04-notifications-and-cycle-tracking.md` (frozen): outbox-over-inline (the charter's transactional-outbox trigger firing in miniature), admin-connection producers/drain, fail-closed dry-run default, system actor id for cron audit rows, no opt-out, Monday 07:00 UTC. Index it in `decisions/README.md`.
- [ ] **Step 2:** `docs/plans/notifications.md`: Status → `in progress`, Readiness → `ready`; fix the drain-connection/grants line (admin, not app — code is the lock). Charter deferred table: transactional outbox row → `trigger fired — notifications outbox`.
- [ ] **Step 3:** `scripts/README.md`: document the manual cron path (`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/run/<jobId>`) under ops notes; note Resend DNS verification as the one-time setup.
- [ ] **Step 4:** `bun run check:docs`; commit `docs(decisions): notifications and cycle tracking adr; plan lifecycle updates`

---

## Self-Review checklist

- Spec coverage: obligations (T1), outbox (T2/T3), cron+Resend (T4/T6/T7), producers (T5), tracking+dashboard (T8/T9), docs/triggers (T10). Deferred items in the spec stay deferred — no task implements them.
- Type consistency: `EnqueueNotificationInput` defined in T2, consumed in T5/T7; `Obligation`/`ObligationCaseInput` defined in T1, consumed in T7/T8.
- Every convention gate that applies runs in its task: `check:migrations` (T3), `check:env` (T4), `check:nav`/`check:client-barrels` (T9), `check:docs` (T10).
