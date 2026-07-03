import { eq, inArray, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { NotFoundError } from "@agds-hr/shared";

import { selfReview } from "./db/schema.ts";
import type { SelfReview } from "./types.ts";

// Self-review DAL (design: "input, not the rating"). The subject's own words —
// visible to the subject, their manager, and leadership (enforced at the
// handler layer). Drafts autosave locally in the client; the server copy is
// written on explicit save/submit so every server mutation stays audited
// without drowning the trail in keystrokes.

const rowToSelfReview = (row: {
  readonly caseId: string;
  readonly payload: unknown;
  readonly submittedAt: Date | null;
}): SelfReview => ({
  caseId: row.caseId,
  payload: (row.payload ?? {}) as Readonly<Record<string, string>>,
  submittedAt: row.submittedAt ?? undefined,
});

export async function getSelfReviewByCase(
  db: DrizzleExecutor,
  caseId: string,
): Promise<SelfReview | undefined> {
  const [row] = await db
    .select({
      caseId: selfReview.caseId,
      payload: selfReview.payload,
      submittedAt: selfReview.submittedAt,
    })
    .from(selfReview)
    .where(eq(selfReview.caseId, caseId))
    .limit(1);
  return row === undefined ? undefined : rowToSelfReview(row);
}

export async function listSelfReviewsByCases(
  db: DrizzleExecutor,
  caseIds: readonly string[],
): Promise<readonly SelfReview[]> {
  if (caseIds.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      caseId: selfReview.caseId,
      payload: selfReview.payload,
      submittedAt: selfReview.submittedAt,
    })
    .from(selfReview)
    .where(inArray(selfReview.caseId, [...caseIds]));
  return rows.map(rowToSelfReview);
}

export async function saveSelfReview(
  db: DrizzleDb,
  caseId: string,
  payload: Readonly<Record<string, string>>,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(selfReview)
      .values({ caseId, payload })
      .onConflictDoUpdate({ target: selfReview.caseId, set: { payload } });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.self_review.saved",
      resourceId: caseId,
      payload: { fields: Object.keys(payload).length },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function submitSelfReview(
  db: DrizzleDb,
  caseId: string,
  payload: Readonly<Record<string, string>>,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(selfReview)
      .values({ caseId, payload, submittedAt: sql`now()` })
      .onConflictDoUpdate({
        target: selfReview.caseId,
        set: { payload, submittedAt: sql`now()` },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.self_review.submitted",
      resourceId: caseId,
      payload: { fields: Object.keys(payload).length },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function reopenSelfReview(
  db: DrizzleDb,
  caseId: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: selfReview.id })
      .from(selfReview)
      .where(eq(selfReview.caseId, caseId))
      .limit(1);
    if (existing === undefined) {
      throw new NotFoundError("self review", caseId);
    }
    await tx.update(selfReview).set({ submittedAt: null }).where(eq(selfReview.caseId, caseId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.self_review.reopened",
      resourceId: caseId,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
