import { describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";

import { auditEvents } from "@agds-hr/audit/db/schema";
import { getDbAs } from "@agds-hr/db";
import { outbox } from "@agds-hr/notifications/db/schema";
import { ConflictError, RequestId, UserId } from "@agds-hr/shared";

import {
  approvePeerRequest,
  cancelPeerRequest,
  createPeerRequests,
  peerRequestHasAnswerText,
  proposePeerRequests,
  reopenPeerRequest,
  submitPeerInput,
} from "./peer-input.ts";
import { peerRequest } from "./db/schema.ts";
import { openCase } from "./review.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them.
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

const ctx = () => {
  const actor = UserId(crypto.randomUUID());
  return { actorUserId: actor, subjectUserId: actor, requestId: RequestId(crypto.randomUUID()) };
};

describe("peerRequestHasAnswerText", () => {
  test("empty and blank payloads are unanswered", () => {
    expect(peerRequestHasAnswerText(undefined)).toBe(false);
    expect(peerRequestHasAnswerText(null)).toBe(false);
    expect(peerRequestHasAnswerText({})).toBe(false);
    expect(peerRequestHasAnswerText({ p_keep: "", p_improve: "  " })).toBe(false);
  });

  test("any trimmed non-empty string counts as retained input", () => {
    expect(peerRequestHasAnswerText({ p_keep: "solid work" })).toBe(true);
    expect(peerRequestHasAnswerText({ p_keep: "", p_context: " x " })).toBe(true);
  });
});

describe.skipIf(!sentinelSet)("[integration] peer request notifications", () => {
  test("creating a live request enqueues ONE outbox row per requestee, idempotently", async () => {
    const db = getDbAs("admin");
    const subject = `pr-subj-${crypto.randomUUID()}@albertschool.com`;
    const requestee = `pr-req-${crypto.randomUUID()}@albertschool.com`;
    const context = ctx();

    const opened = await openCase(db, subject, "2026", context);
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );
    // Re-creating the same requestee: no second request row, no second email.
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );

    const rows = await db
      .select({ kind: outbox.kind, payload: outbox.payload })
      .from(outbox)
      .where(eq(outbox.recipientEmail, requestee));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("peer_request.created");
    expect((rows[0]!.payload as Record<string, unknown>).subjectEmail).toBe(subject);
  });

  test("a proposal enqueues nothing until the manager approves it", async () => {
    const db = getDbAs("admin");
    const subject = `pp-subj-${crypto.randomUUID()}@albertschool.com`;
    const requestee = `pp-req-${crypto.randomUUID()}@albertschool.com`;
    const context = ctx();

    const opened = await openCase(db, subject, "2026", context);
    await proposePeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );

    const before = await db
      .select({ id: outbox.id })
      .from(outbox)
      .where(eq(outbox.recipientEmail, requestee));
    expect(before).toHaveLength(0);

    const [proposal] = await db
      .select({ id: peerRequest.id })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));
    await approvePeerRequest(db, proposal!.id, context);

    const after = await db
      .select({ kind: outbox.kind })
      .from(outbox)
      .where(eq(outbox.recipientEmail, requestee));
    expect(after).toHaveLength(1);
    expect(after[0]?.kind).toBe("peer_request.created");
  });
});

describe.skipIf(!sentinelSet)("[integration] peer request cancellation", () => {
  test("cancelling a pending request deletes it, audits it, and frees the slot", async () => {
    const db = getDbAs("admin");
    const subject = `pc-subj-${crypto.randomUUID()}@albertschool.com`;
    const requestee = `pc-req-${crypto.randomUUID()}@albertschool.com`;
    const context = ctx();

    const opened = await openCase(db, subject, "2026", context);
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );
    const [created] = await db
      .select({ id: peerRequest.id })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));

    await cancelPeerRequest(db, created!.id, context);

    const remaining = await db
      .select({ id: peerRequest.id })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));
    expect(remaining).toHaveLength(0);

    const events = await db
      .select({ payload: auditEvents.payload })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventType, "people.peer.cancelled"),
          eq(auditEvents.resourceId, created!.id),
        ),
      );
    expect(events).toHaveLength(1);
    expect((events[0]!.payload as Record<string, unknown>).requestee).toBe(requestee);

    // The (case, requestee) unique slot is free again — re-requesting works.
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );
    const recreated = await db
      .select({ status: peerRequest.status })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));
    expect(recreated).toHaveLength(1);
    expect(recreated[0]?.status).toBe("pending");
  });

  test("an answered request cannot be cancelled", async () => {
    const db = getDbAs("admin");
    const subject = `pc2-subj-${crypto.randomUUID()}@albertschool.com`;
    const requestee = `pc2-req-${crypto.randomUUID()}@albertschool.com`;
    const context = ctx();

    const opened = await openCase(db, subject, "2026", context);
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );
    const [created] = await db
      .select({ id: peerRequest.id })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));
    await submitPeerInput(db, created!.id, requestee, { p_keep: "solid work" }, context);

    expect(cancelPeerRequest(db, created!.id, context)).rejects.toThrow(ConflictError);

    const rows = await db
      .select({ status: peerRequest.status })
      .from(peerRequest)
      .where(eq(peerRequest.id, created!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("submitted");
  });

  // Reopen leaves answers on a pending row — cancel must not wipe them
  // (manager "undo reopen" trap on /peer-input).
  test("a reopened request with retained input cannot be cancelled", async () => {
    const db = getDbAs("admin");
    const subject = `pc3-subj-${crypto.randomUUID()}@albertschool.com`;
    const requestee = `pc3-req-${crypto.randomUUID()}@albertschool.com`;
    const context = ctx();

    const opened = await openCase(db, subject, "2026", context);
    await createPeerRequests(
      db,
      opened.id,
      context.actorUserId,
      [{ email: requestee, kind: "cross" }],
      context,
    );
    const [created] = await db
      .select({ id: peerRequest.id })
      .from(peerRequest)
      .where(eq(peerRequest.requesteeEmail, requestee));
    await submitPeerInput(db, created!.id, requestee, { p_keep: "solid work" }, context);
    await reopenPeerRequest(db, created!.id, context);

    await expect(cancelPeerRequest(db, created!.id, context)).rejects.toThrow(
      /conflict: peer_request_has_input/,
    );

    const rows = await db
      .select({ status: peerRequest.status, input: peerRequest.input })
      .from(peerRequest)
      .where(eq(peerRequest.id, created!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
    expect((rows[0]?.input as Record<string, string>).p_keep).toBe("solid work");
  });
});
