import { describe, expect, test } from "bun:test";

import { user } from "@agds-hr/auth/db/schema";
import { getDbAs } from "@agds-hr/db";
import { UserId } from "@agds-hr/shared";

import { listDirectory } from "./dal.ts";
import { employee } from "./db/schema.ts";

// Fail closed: integration suites run only under the disposable-branch wrapper
// (bootstrap step 7); a bare `bun test` skips them (mirrors audit/identity).
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

describe.skipIf(!sentinelSet)("[integration] people directory", () => {
  test("listDirectory returns active employees joined to their user", async () => {
    const db = getDbAs("admin");
    const email = `dir-${crypto.randomUUID()}@albertschool.com`;
    const [row] = await db
      .insert(user)
      .values({ name: "Dir Test", email, displayName: "Dir Test" })
      .returning({ id: user.id });
    const userId = UserId(row!.id);
    await db
      .insert(employee)
      .values({ userId, level: "L3", path: "ic", country: "France", roleFamily: "Engineering" });

    const directory = await listDirectory(db);
    const entry = directory.find((candidate) => candidate.userId === userId);
    expect(entry).toBeDefined();
    expect(entry?.level).toBe("L3");
    expect(entry?.path).toBe("ic");
    expect(entry?.rating).toBeUndefined();
  });
});
