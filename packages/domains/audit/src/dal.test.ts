import { describe, expect, test } from "bun:test";

import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import { listEvents, recordEvent } from "./dal.ts";
import { auditEvents } from "./db/schema.ts";

// Fail closed: integration suites run only under the disposable-branch test
// wrapper (bootstrap step 7), which remaps TEST_DATABASE_URL_* and sets the
// sentinel. A bare `bun test` skips them by construction.
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

describe.skipIf(!sentinelSet)("[integration] audit domain", () => {
  const actor = UserId("00000000-0000-4000-8000-000000000001");
  const subject = UserId("00000000-0000-4000-8000-000000000002");

  test("recordEvent inside a transaction is readable via listEvents", async () => {
    const db = getDbAs("app");
    const requestId = RequestId(crypto.randomUUID());
    await db.transaction(async (tx) => {
      await recordEvent(tx, {
        actorUserId: actor,
        subjectUserId: subject,
        domain: "identity",
        eventType: "user.deactivated",
        resourceId: subject,
        payload: { deactivatedAt: { before: null, after: "now" } },
        requestId,
        ip: "127.0.0.1",
      });
    });

    const events = await listEvents(db, {
      domain: "identity",
      subjectUserId: subject,
      limit: 10,
    });
    const event = events.find((candidate) => candidate.requestId === requestId);
    expect(event).toBeDefined();
    expect(event?.actorUserId).toBe(actor);
    expect(event?.eventType).toBe("user.deactivated");
    expect(event?.ip).toBe("127.0.0.1");
  });

  test("audit.events rejects DELETE — append-only trigger and grants both fail closed", async () => {
    const db = getDbAs("app");
    expect(db.delete(auditEvents)).rejects.toThrow();
  });
});
