import { timingSafeEqual } from "node:crypto";

import type { AuditContext } from "@agds-hr/audit";
import { getCronJob, isoWeekKey, registerCronJob } from "@agds-hr/cron";
import { getDbAs } from "@agds-hr/db";
import { readOptional } from "@agds-hr/env";
import {
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
  renderNotification,
  enqueueNotification,
} from "@agds-hr/notifications";
import { isEmailDryRun, isResendConfigured, sendTransactional } from "@agds-hr/resend";
import { RequestId, UserId } from "@agds-hr/shared";

import { collectCycleObligations } from "./obligations.server.ts";

// Cron composition root (docs/decisions/2026-07-03-cloudflare-hosting.md +
// 2026-07-04-notifications-and-cycle-tracking): job definitions registered
// against the pure @agds-hr/cron registry, invoked by the Worker's scheduled
// handler (Cloudflare Cron Triggers) or manually via the bearer-guarded
// /api/cron/run/<jobId> route.

// Cron runs have no session; audit rows still need actor/subject uuids. This
// fixed system id marks machine-initiated events — recognizable in the audit
// log, never a real auth.user.
export const SYSTEM_ACTOR_ID = "00000000-0000-4000-8000-000000000c40";

const cronAuditContext = (): AuditContext => ({
  actorUserId: UserId(SYSTEM_ACTOR_ID),
  subjectUserId: UserId(SYSTEM_ACTOR_ID),
  requestId: RequestId(crypto.randomUUID()),
});

// Drain the outbox: render + send each pending row, mark sent/failed per row
// so one bad row never blocks the batch. Fail closed on configuration: live
// mode without a Resend key throws — rows stay pending, nothing is dropped.
async function drainNotifications(): Promise<Record<string, unknown>> {
  const dryRun = isEmailDryRun();
  if (!dryRun && !isResendConfigured()) {
    throw new Error("resend_not_configured: RESEND_API_KEY is unset (see .env.example)");
  }
  const adminDb = getDbAs("admin");
  const pending = await listPendingNotifications(adminDb);
  let sent = 0;
  let failed = 0;
  for (const notification of pending) {
    try {
      const rendered = renderNotification(notification.kind, notification.payload);
      await sendTransactional({
        to: notification.recipientEmail,
        subject: rendered.subject,
        text: rendered.text,
      });
      await markNotificationSent(adminDb, notification.id, cronAuditContext());
      sent += 1;
    } catch (error) {
      await markNotificationFailed(
        adminDb,
        notification.id,
        error instanceof Error ? error.message : String(error),
        cronAuditContext(),
      );
      failed += 1;
    }
  }
  return { pending: pending.length, sent, failed, dryRun };
}

// Monday digest: everyone with open obligations gets their own list; managers
// get their reports' open items; HR (admins + founders) gets org-wide counts.
// Idempotent per ISO week via the dedupe key — re-running enqueues nothing.
// No open obligations = no email, by design (fail closed, not an error).
async function weeklyDigest(): Promise<Record<string, unknown>> {
  const adminDb = getDbAs("admin");
  const { obligations, reportsByManager, hrEmails } = await collectCycleObligations(adminDb);
  if (obligations.length === 0) {
    return { skipped: true, reason: "no_open_obligations" };
  }
  const week = isoWeekKey(new Date());
  let enqueued = 0;

  const byOwner = new Map<string, { kind: string; subjectEmail: string }[]>();
  for (const obligation of obligations) {
    const bucket = byOwner.get(obligation.ownerEmail);
    const item = { kind: obligation.kind, subjectEmail: obligation.subjectEmail };
    if (bucket === undefined) {
      byOwner.set(obligation.ownerEmail, [item]);
    } else {
      bucket.push(item);
    }
  }
  for (const [ownerEmail, items] of byOwner) {
    await enqueueNotification(adminDb, {
      kind: "digest.individual",
      recipientEmail: ownerEmail,
      payload: { items },
      dedupeKey: `digest.individual:${ownerEmail}:${week}`,
    });
    enqueued += 1;
  }

  for (const [managerEmail, reports] of reportsByManager) {
    const items = obligations
      .filter(
        (obligation) =>
          reports.has(obligation.subjectEmail) && obligation.ownerEmail !== managerEmail,
      )
      .map((obligation) => ({ kind: obligation.kind, subjectEmail: obligation.subjectEmail }));
    if (items.length === 0) {
      continue;
    }
    await enqueueNotification(adminDb, {
      kind: "digest.manager",
      recipientEmail: managerEmail,
      payload: { items },
      dedupeKey: `digest.manager:${managerEmail}:${week}`,
    });
    enqueued += 1;
  }

  const counts: Record<string, number> = {};
  for (const obligation of obligations) {
    counts[obligation.kind] = (counts[obligation.kind] ?? 0) + 1;
  }
  for (const hrEmail of hrEmails) {
    await enqueueNotification(adminDb, {
      kind: "digest.hr",
      recipientEmail: hrEmail,
      payload: { total: obligations.length, counts },
      dedupeKey: `digest.hr:${hrEmail}:${week}`,
    });
    enqueued += 1;
  }

  return { obligations: obligations.length, enqueued, week };
}

// Idempotent against dev HMR, like registerPolicies.
export function registerCronJobs(): void {
  if (getCronJob("drain-notifications") !== undefined) {
    return;
  }
  registerCronJob({ id: "drain-notifications", run: drainNotifications });
  registerCronJob({ id: "weekly-digest", run: weeklyDigest });
}

// Cloudflare Cron Triggers pass the firing cron expression; map it to a job.
// Kept in one place next to wrangler.jsonc's triggers list.
export const CRON_SCHEDULE_JOBS: Record<string, string> = {
  "*/5 * * * *": "drain-notifications",
  "0 7 * * 1": "weekly-digest",
};

export async function runScheduledJob(cronExpression: string): Promise<void> {
  registerCronJobs();
  const jobId = CRON_SCHEDULE_JOBS[cronExpression];
  if (jobId === undefined) {
    console.error(`cron: no job mapped for schedule ${JSON.stringify(cronExpression)}`);
    return;
  }
  const job = getCronJob(jobId);
  if (job === undefined) {
    console.error(`cron: job not registered: ${jobId}`);
    return;
  }
  const result = await job.run();
  console.log(`cron: ${jobId} ${JSON.stringify(result)}`);
}

const constantTimeEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

// Manual runner: /api/cron/run/<jobId> with a CRON_SECRET bearer. Fails closed
// on every branch — unset secret is 503, wrong secret 401, unknown job 404.
export async function handleCronRequest(request: Request): Promise<Response> {
  const secret = readOptional("CRON_SECRET");
  if (secret === undefined) {
    return Response.json({ error: "cron_secret_unset" }, { status: 503 });
  }
  const bearer = request.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ") || !constantTimeEquals(bearer.slice(7), secret)) {
    return Response.json({ error: "cron_unauthorized" }, { status: 401 });
  }
  const jobId = new URL(request.url).pathname.replace(/^\/api\/cron\/run\//, "");
  registerCronJobs();
  const job = getCronJob(jobId);
  if (job === undefined) {
    return Response.json({ error: `cron_job_not_found: ${jobId}` }, { status: 404 });
  }
  try {
    const result = await job.run();
    return Response.json({ jobId, result });
  } catch (error) {
    return Response.json(
      { jobId, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
