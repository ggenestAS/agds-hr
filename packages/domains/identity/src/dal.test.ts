import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { user } from "@agds-hr/auth/db/schema";
import { getDbAs } from "@agds-hr/db";
import { RequestId, UserId } from "@agds-hr/shared";

import {
  deactivateUser,
  grantRole,
  hydrateUser,
  readActiveImpersonation,
  revokeRole,
  startImpersonation,
  stopImpersonation,
} from "./dal.ts";

// Fail closed: integration suites run only under the disposable-branch test
// wrapper (bootstrap step 7), which remaps TEST_DATABASE_URL_* and sets the
// sentinel. A bare `bun test` skips them by construction (mirrors audit).
const sentinelSet = process.env.AGDS_HR_TEST_DB === "1";

describe.skipIf(!sentinelSet)("[integration] identity domain", () => {
  const admin = () => getDbAs("admin");
  const ctx = (actor: UserId, subject: UserId) => ({
    actorUserId: actor,
    subjectUserId: subject,
    requestId: RequestId(crypto.randomUUID()),
  });

  const seedUser = async (email: string): Promise<UserId> => {
    const [row] = await admin()
      .insert(user)
      .values({ name: email, email })
      .returning({ id: user.id });
    return UserId(row!.id);
  };

  test("grantRole then hydrateUser reflects the role; revokeRole removes it", async () => {
    const id = await seedUser(`grant-${crypto.randomUUID()}@albertschool.com`);
    await grantRole(admin(), id, "developer", ctx(id, id));
    expect((await hydrateUser(admin(), id))?.roles).toContain("developer");
    await revokeRole(admin(), id, "developer", ctx(id, id));
    expect((await hydrateUser(admin(), id))?.roles ?? []).not.toContain("developer");
  });

  test("deactivateUser sets deactivation state read by hydrateUser", async () => {
    const id = await seedUser(`deact-${crypto.randomUUID()}@albertschool.com`);
    expect((await hydrateUser(admin(), id))?.deactivatedAt).toBeNull();
    await deactivateUser(admin(), id, ctx(id, id));
    expect((await hydrateUser(admin(), id))?.deactivatedAt).not.toBeNull();
  });

  test("start/stop impersonation is reflected by readActiveImpersonation", async () => {
    const actor = await seedUser(`actor-${crypto.randomUUID()}@albertschool.com`);
    const subject = await seedUser(`subject-${crypto.randomUUID()}@albertschool.com`);
    await startImpersonation(admin(), actor, subject, "investigating", ctx(actor, subject));
    expect(await readActiveImpersonation(admin(), actor)).toBe(subject);
    await stopImpersonation(admin(), actor, ctx(actor, actor));
    expect(await readActiveImpersonation(admin(), actor)).toBeNull();
  });

  test("grant boundary: app_role reads identity tables but is denied auth.user.email (§6.1)", async () => {
    const actor = await seedUser(`bnd-actor-${crypto.randomUUID()}@albertschool.com`);
    const subject = await seedUser(`bnd-subj-${crypto.randomUUID()}@albertschool.com`);
    await startImpersonation(admin(), actor, subject, undefined, ctx(actor, subject));
    // app_role has SELECT on identity.impersonation_session.
    expect(await readActiveImpersonation(getDbAs("app"), actor)).toBe(subject);
    // app_role has no column grant on auth.user.email — the read must fail closed.
    const app = getDbAs("app");
    expect(
      app.select({ email: user.email }).from(user).where(eq(user.id, actor)),
    ).rejects.toThrow();
  });
});
