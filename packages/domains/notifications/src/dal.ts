import { and, asc, isNull, lt, sql, eq } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";

import { outbox } from "./db/schema.ts";

// Outbox DAL. `enqueueNotification` runs on the PRODUCER'S executor — inside
// the same transaction as the mutation it announces (§8.2, same contract as
// recordEvent) — so a notification exists iff its trigger committed. Sending
// is the drain cron's job; send bookkeeping mutations own their transaction
// and are audited.

// After this many failed sends a row is abandoned: still visible by query,
// no longer retried. Alerting on abandoned rows is deferred with a named
// trigger (docs/plans/notifications.md).
export const MAX_SEND_ATTEMPTS = 5;

export type EnqueueNotificationInput = {
  readonly kind: string;
  readonly recipientEmail: string;
  readonly payload: Record<string, unknown>;
  readonly dedupeKey: string;
};

// Idempotent: a duplicate dedupe key is a silent no-op — the obligation is
// already queued (or already sent).
export async function enqueueNotification(
  executor: DrizzleExecutor,
  input: EnqueueNotificationInput,
): Promise<void> {
  await executor
    .insert(outbox)
    .values({
      kind: input.kind,
      recipientEmail: input.recipientEmail.toLowerCase(),
      payload: input.payload,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing();
}

export type PendingNotification = {
  readonly id: string;
  readonly kind: string;
  readonly recipientEmail: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly createdAt: Date;
};

export async function listPendingNotifications(
  db: DrizzleExecutor,
  limit = 50,
): Promise<readonly PendingNotification[]> {
  const rows = await db
    .select({
      id: outbox.id,
      kind: outbox.kind,
      recipientEmail: outbox.recipientEmail,
      payload: outbox.payload,
      attempts: outbox.attempts,
      createdAt: outbox.createdAt,
    })
    .from(outbox)
    .where(and(isNull(outbox.sentAt), lt(outbox.attempts, MAX_SEND_ATTEMPTS)))
    .orderBy(asc(outbox.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    recipientEmail: row.recipientEmail,
    payload: row.payload as Record<string, unknown>,
    attempts: row.attempts,
    createdAt: row.createdAt,
  }));
}

export async function markNotificationSent(
  db: DrizzleDb,
  id: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(outbox)
      .set({ sentAt: sql`now()` })
      .where(eq(outbox.id, id));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "notifications",
      eventType: "notifications.outbox.sent",
      resourceId: id,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function markNotificationFailed(
  db: DrizzleDb,
  id: string,
  error: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(outbox)
      .set({ attempts: sql`${outbox.attempts} + 1`, lastError: error })
      .where(eq(outbox.id, id));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "notifications",
      eventType: "notifications.outbox.failed",
      resourceId: id,
      payload: { error },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
