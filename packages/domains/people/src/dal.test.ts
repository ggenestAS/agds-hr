import { describe, expect, test } from "bun:test";

import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import { getEmployeeByEmail, listEmployeeAttrs, upsertEmployeeByEmail } from "./dal.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them (mirrors audit/identity).
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

describe.skipIf(!sentinelSet)("[integration] people employee attributes", () => {
  test("upsert by email sets attrs; re-upsert updates the same active row", async () => {
    const db = getDbAs("admin");
    const email = `emp-${crypto.randomUUID()}@albertschool.com`;
    const actor = UserId(crypto.randomUUID());
    const ctx = {
      actorUserId: actor,
      subjectUserId: actor,
      requestId: RequestId(crypto.randomUUID()),
    };

    await upsertEmployeeByEmail(db, { email, level: "L2", path: "ic" }, ctx);
    expect((await getEmployeeByEmail(db, email))?.level).toBe("L2");

    await upsertEmployeeByEmail(db, { email, level: "L3", path: "manager" }, ctx);
    const updated = await getEmployeeByEmail(db, email);
    expect(updated?.level).toBe("L3");
    expect(updated?.path).toBe("manager");

    expect((await listEmployeeAttrs(db)).some((attrs) => attrs.email === email)).toBe(true);
  });
});
