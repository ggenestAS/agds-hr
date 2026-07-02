import { describe, expect, test } from "bun:test";

import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import {
  advanceCase,
  getCaseBySubject,
  listRatingsForCycle,
  openCase,
  setCaseRating,
} from "./review.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them.
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

describe.skipIf(!sentinelSet)("[integration] review cases", () => {
  test("open (idempotent) -> advance (valid) -> rate; illegal transition throws", async () => {
    const db = getDbAs("admin");
    const email = `rev-${crypto.randomUUID()}@albertschool.com`;
    const actor = UserId(crypto.randomUUID());
    const ctx = {
      actorUserId: actor,
      subjectUserId: actor,
      requestId: RequestId(crypto.randomUUID()),
    };

    const opened = await openCase(db, email, "2026", ctx);
    expect(opened.state).toBe("self_review");
    expect((await openCase(db, email, "2026", ctx)).id).toBe(opened.id); // idempotent

    await advanceCase(db, opened.id, "manager_assessment", ctx);
    await setCaseRating(db, opened.id, 3, ctx);

    const rated = await getCaseBySubject(db, email, "2026");
    expect(rated?.state).toBe("manager_assessment");
    expect(rated?.rating).toBe(3);
    expect((await listRatingsForCycle(db, "2026")).get(email)).toBe(3);

    expect(advanceCase(db, opened.id, "self_review", ctx)).rejects.toThrow(
      "invalid_review_transition",
    );
  });
});
