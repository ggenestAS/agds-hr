import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { getDbAs } from "@agds-hr/db";
import { outbox } from "@agds-hr/notifications/db/schema";
import { RequestId, UserId } from "@agds-hr/shared";

import { approvePeerRequest, createPeerRequests, proposePeerRequests } from "./peer-input.ts";
import { peerRequest } from "./db/schema.ts";
import { openCase } from "./review.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them.
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

const ctx = () => {
  const actor = UserId(crypto.randomUUID());
  return { actorUserId: actor, subjectUserId: actor, requestId: RequestId(crypto.randomUUID()) };
};

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
