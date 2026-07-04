import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { enqueueNotification } from "@agds-hr/notifications";
import { ConflictError, ForbiddenError, NotFoundError, UserId } from "@agds-hr/shared";

import { peerRequest, reviewCase } from "./db/schema.ts";
import type { EvaluationDimension, PeerKind, PeerRequest, PeerRequestStatus } from "./types.ts";

// Peer input DAL (design M5): NAMED input — never anonymous, never shown to
// the person being reviewed (enforced at the handler layer by excluding the
// subject's own case from reviewer views). Declines are allowed but logged
// with a reason. Mutations audited.

const SELECT = {
  id: peerRequest.id,
  caseId: peerRequest.caseId,
  requesteeEmail: peerRequest.requesteeEmail,
  kind: peerRequest.kind,
  status: peerRequest.status,
  declineReason: peerRequest.declineReason,
  input: peerRequest.input,
  submittedAt: peerRequest.submittedAt,
  createdAt: peerRequest.createdAt,
};

type PeerRequestRow = {
  readonly id: string;
  readonly caseId: string;
  readonly requesteeEmail: string;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly declineReason: string | null;
  readonly input: unknown;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
};

const rowToPeerRequest = (row: PeerRequestRow): PeerRequest => ({
  id: row.id,
  caseId: row.caseId,
  requesteeEmail: row.requesteeEmail,
  kind: row.kind,
  status: row.status,
  declineReason: row.declineReason ?? undefined,
  input: (row.input ?? {}) as PeerRequest["input"],
  submittedAt: row.submittedAt ?? undefined,
  createdAt: row.createdAt,
});

export async function listPeerRequestsForCase(
  db: DrizzleExecutor,
  caseId: string,
): Promise<readonly PeerRequest[]> {
  const rows = await db
    .select(SELECT)
    .from(peerRequest)
    .where(eq(peerRequest.caseId, caseId))
    .orderBy(desc(peerRequest.createdAt));
  return rows.map(rowToPeerRequest);
}

export async function listPeerRequestsForCases(
  db: DrizzleExecutor,
  caseIds: readonly string[],
): Promise<readonly PeerRequest[]> {
  if (caseIds.length === 0) {
    return [];
  }
  const rows = await db
    .select(SELECT)
    .from(peerRequest)
    .where(inArray(peerRequest.caseId, [...caseIds]))
    .orderBy(desc(peerRequest.createdAt));
  return rows.map(rowToPeerRequest);
}

// "Requests for you" — includes the case's subject so the requestee knows who
// the input is about (the request itself is not secret from the requestee).
export type PeerRequestForRequestee = PeerRequest & { readonly subjectEmail: string };

export async function listPeerRequestsForRequestee(
  db: DrizzleExecutor,
  requesteeEmail: string,
): Promise<readonly PeerRequestForRequestee[]> {
  const rows = await db
    .select({ ...SELECT, subjectEmail: reviewCase.subjectEmail })
    .from(peerRequest)
    .innerJoin(reviewCase, eq(reviewCase.id, peerRequest.caseId))
    .where(eq(peerRequest.requesteeEmail, requesteeEmail))
    .orderBy(desc(peerRequest.createdAt));
  return rows.map((row) => ({ ...rowToPeerRequest(row), subjectEmail: row.subjectEmail }));
}

// A live (pending) peer request emails its requestee — enqueued in the SAME
// transaction as the request row (docs/plans/notifications.md). The dedupe key
// is per case+requestee, shared by both paths to "pending" (direct creation
// and proposal approval), so a person is nudged once per case regardless of
// how the request came to exist.
async function enqueuePeerRequestNotifications(
  tx: DrizzleExecutor,
  caseId: string,
  requesteeEmails: readonly string[],
): Promise<void> {
  const [subject] = await tx
    .select({ subjectEmail: reviewCase.subjectEmail })
    .from(reviewCase)
    .where(eq(reviewCase.id, caseId))
    .limit(1);
  if (subject === undefined) {
    return;
  }
  for (const email of requesteeEmails) {
    await enqueueNotification(tx, {
      kind: "peer_request.created",
      recipientEmail: email,
      payload: { subjectEmail: subject.subjectEmail.toLowerCase(), caseId },
      dedupeKey: `peer_request.created:${caseId}:${email.toLowerCase()}`,
    });
  }
}

// Create requests for a case (reviewer action). Idempotent per requestee —
// re-requesting an existing requestee is a no-op, not an error.
export async function createPeerRequests(
  db: DrizzleDb,
  caseId: string,
  requestedBy: UserId,
  entries: readonly { readonly email: string; readonly kind: PeerKind }[],
  context: AuditContext,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(peerRequest)
      .values(
        entries.map((entry) => ({
          caseId,
          requesteeEmail: entry.email.toLowerCase(),
          kind: entry.kind,
          requestedBy,
        })),
      )
      .onConflictDoNothing();
    await enqueuePeerRequestNotifications(
      tx,
      caseId,
      entries.map((entry) => entry.email.toLowerCase()),
    );
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.requested",
      resourceId: caseId,
      payload: { requestees: entries.map((entry) => entry.email.toLowerCase()) },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// The SUBJECT proposes requestees for their own case (improve-ux plan):
// rows land in `proposed` status and only become real requests once the
// manager approves. Idempotent per requestee like createPeerRequests.
export async function proposePeerRequests(
  db: DrizzleDb,
  caseId: string,
  proposedBy: UserId,
  entries: readonly { readonly email: string; readonly kind: PeerKind }[],
  context: AuditContext,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(peerRequest)
      .values(
        entries.map((entry) => ({
          caseId,
          requesteeEmail: entry.email.toLowerCase(),
          kind: entry.kind,
          status: "proposed" as const,
          requestedBy: proposedBy,
        })),
      )
      .onConflictDoNothing();
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.proposed",
      resourceId: caseId,
      payload: { requestees: entries.map((entry) => entry.email.toLowerCase()) },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Manager approval turns a proposal into a live request (proposed -> pending).
export async function approvePeerRequest(
  db: DrizzleDb,
  requestId: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: peerRequest.status,
        caseId: peerRequest.caseId,
        requesteeEmail: peerRequest.requesteeEmail,
      })
      .from(peerRequest)
      .where(eq(peerRequest.id, requestId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("peer request", requestId);
    }
    if (current.status !== "proposed") {
      throw new ConflictError("peer_request_not_proposed");
    }
    await tx
      .update(peerRequest)
      .set({ status: "pending" })
      .where(and(eq(peerRequest.id, requestId), eq(peerRequest.status, "proposed")));
    // Approval is when the request becomes real for the requestee — notify now,
    // not at proposal time (a rejected proposal must never email anyone).
    await enqueuePeerRequestNotifications(tx, current.caseId, [current.requesteeEmail]);
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.approved",
      resourceId: requestId,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Rejecting a proposal removes it (the manager said no — there is nothing to
// keep). The subject can propose someone else; the rejection is audited.
export async function rejectPeerRequest(
  db: DrizzleDb,
  requestId: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: peerRequest.status, requesteeEmail: peerRequest.requesteeEmail })
      .from(peerRequest)
      .where(eq(peerRequest.id, requestId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("peer request", requestId);
    }
    if (current.status !== "proposed") {
      throw new ConflictError("peer_request_not_proposed");
    }
    await tx
      .delete(peerRequest)
      .where(and(eq(peerRequest.id, requestId), eq(peerRequest.status, "proposed")));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.rejected",
      resourceId: requestId,
      payload: { requestee: current.requesteeEmail },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// A submitted peer review is locked for its author; the SUBJECT'S manager may
// reopen it (submitted -> pending, input kept for editing). The manager-of
// check lives at the handler layer next to the org graph.
export async function reopenPeerRequest(
  db: DrizzleDb,
  requestId: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: peerRequest.status })
      .from(peerRequest)
      .where(eq(peerRequest.id, requestId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("peer request", requestId);
    }
    if (current.status !== "submitted") {
      throw new ConflictError("peer_request_not_submitted");
    }
    await tx
      .update(peerRequest)
      .set({ status: "pending", submittedAt: null })
      .where(and(eq(peerRequest.id, requestId), eq(peerRequest.status, "submitted")));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.reopened",
      resourceId: requestId,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// One request with its case subject — the dedicated answer page's loader.
export async function getPeerRequestById(
  db: DrizzleExecutor,
  requestId: string,
): Promise<PeerRequestForRequestee | undefined> {
  const [row] = await db
    .select({ ...SELECT, subjectEmail: reviewCase.subjectEmail })
    .from(peerRequest)
    .innerJoin(reviewCase, eq(reviewCase.id, peerRequest.caseId))
    .where(eq(peerRequest.id, requestId))
    .limit(1);
  return row === undefined
    ? undefined
    : { ...rowToPeerRequest(row), subjectEmail: row.subjectEmail };
}

// Submit named input. Only the addressed requestee may submit, only once.
export async function submitPeerInput(
  db: DrizzleDb,
  requestId: string,
  requesteeEmail: string,
  input: Readonly<Partial<Record<EvaluationDimension, string>>>,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ requesteeEmail: peerRequest.requesteeEmail, status: peerRequest.status })
      .from(peerRequest)
      .where(eq(peerRequest.id, requestId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("peer request", requestId);
    }
    if (current.requesteeEmail !== requesteeEmail.toLowerCase()) {
      throw new ForbiddenError("people.peer.respond", "not_addressed_to_you");
    }
    if (current.status !== "pending") {
      throw new ConflictError("peer_request_already_answered");
    }
    await tx
      .update(peerRequest)
      .set({ status: "submitted", input, submittedAt: sql`now()` })
      .where(and(eq(peerRequest.id, requestId), eq(peerRequest.status, "pending")));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.submitted",
      resourceId: requestId,
      payload: { dimensions: Object.keys(input).length },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Declines are allowed but logged with a reason (design).
export async function declinePeerRequest(
  db: DrizzleDb,
  requestId: string,
  requesteeEmail: string,
  reason: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ requesteeEmail: peerRequest.requesteeEmail, status: peerRequest.status })
      .from(peerRequest)
      .where(eq(peerRequest.id, requestId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("peer request", requestId);
    }
    if (current.requesteeEmail !== requesteeEmail.toLowerCase()) {
      throw new ForbiddenError("people.peer.respond", "not_addressed_to_you");
    }
    if (current.status !== "pending") {
      throw new ConflictError("peer_request_already_answered");
    }
    await tx
      .update(peerRequest)
      .set({ status: "declined", declineReason: reason })
      .where(and(eq(peerRequest.id, requestId), eq(peerRequest.status, "pending")));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.peer.declined",
      resourceId: requestId,
      payload: { reason },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
