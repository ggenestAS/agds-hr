import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import {
  enqueueNotification,
  listPendingNotifications,
  markNotificationFailed,
  markNotificationSent,
  MAX_SEND_ATTEMPTS,
} from "./dal.ts";
import { outbox } from "./db/schema.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them.
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

const ctx = () => {
  const actor = UserId(crypto.randomUUID());
  return { actorUserId: actor, subjectUserId: actor, requestId: RequestId(crypto.randomUUID()) };
};

describe.skipIf(!sentinelSet)("[integration] notifications outbox", () => {
  test("enqueue is idempotent on dedupe key; drain lifecycle marks sent", async () => {
    const db = getDbAs("admin");
    const dedupeKey = `test:${crypto.randomUUID()}`;
    const recipient = `n-${crypto.randomUUID()}@albertschool.com`;

    await enqueueNotification(db, {
      kind: "peer_request.created",
      recipientEmail: recipient,
      payload: { subjectEmail: "s@albertschool.com", caseId: "c1" },
      dedupeKey,
    });
    await enqueueNotification(db, {
      kind: "peer_request.created",
      recipientEmail: recipient,
      payload: { subjectEmail: "s@albertschool.com", caseId: "c1" },
      dedupeKey,
    });
    const rows = await db.select().from(outbox).where(eq(outbox.dedupeKey, dedupeKey));
    expect(rows).toHaveLength(1);

    const pendingBefore = await listPendingNotifications(db, 1000);
    const mine = pendingBefore.find((row) => row.recipientEmail === recipient);
    expect(mine).toBeDefined();

    await markNotificationSent(db, mine!.id, ctx());
    const pendingAfter = await listPendingNotifications(db, 1000);
    expect(pendingAfter.some((row) => row.id === mine!.id)).toBe(false);
  });

  test("failures increment attempts; exhausted rows leave the pending set", async () => {
    const db = getDbAs("admin");
    const dedupeKey = `test:${crypto.randomUUID()}`;
    await enqueueNotification(db, {
      kind: "digest.individual",
      recipientEmail: `f-${crypto.randomUUID()}@albertschool.com`,
      payload: { items: [] },
      dedupeKey,
    });
    const [row] = await db
      .select({ id: outbox.id })
      .from(outbox)
      .where(eq(outbox.dedupeKey, dedupeKey));

    for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt += 1) {
      await markNotificationFailed(db, row!.id, "resend_send_failed: 500", ctx());
    }
    const [after] = await db
      .select({ attempts: outbox.attempts, lastError: outbox.lastError })
      .from(outbox)
      .where(eq(outbox.id, row!.id));
    expect(after?.attempts).toBe(MAX_SEND_ATTEMPTS);
    expect(after?.lastError).toBe("resend_send_failed: 500");

    const pending = await listPendingNotifications(db, 1000);
    expect(pending.some((entry) => entry.id === row!.id)).toBe(false);
  });
});
