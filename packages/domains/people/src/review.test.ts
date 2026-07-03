import { describe, expect, test } from "bun:test";

import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import { upsertEmployeeByEmail } from "./dal.ts";
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

  test("openCase fails closed for non-participants; the override opts them back in", async () => {
    const db = getDbAs("admin");
    const actor = UserId(crypto.randomUUID());
    const ctx = {
      actorUserId: actor,
      subjectUserId: actor,
      requestId: RequestId(crypto.randomUUID()),
    };

    const excluded = `frl-${crypto.randomUUID()}@albertschool.com`;
    await upsertEmployeeByEmail(
      db,
      {
        email: excluded,
        level: "L2",
        path: "ic",
        employmentType: "freelance",
        reviewParticipationOverride: null,
      },
      ctx,
    );
    expect(openCase(db, excluded, "2026", ctx)).rejects.toThrow("not_in_review_cycle");

    const optedIn = `frl-in-${crypto.randomUUID()}@albertschool.com`;
    await upsertEmployeeByEmail(
      db,
      {
        email: optedIn,
        level: "L2",
        path: "ic",
        employmentType: "freelance",
        reviewParticipationOverride: "included",
      },
      ctx,
    );
    expect((await openCase(db, optedIn, "2026", ctx)).state).toBe("self_review");
  });
});
