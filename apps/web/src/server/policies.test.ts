import { afterEach, describe, expect, test } from "bun:test";

import { can, POLICY_BOOTSTRAP_PROBE, __resetPolicyRegistryForTests } from "@agds-hr/auth";
import type { User } from "@agds-hr/auth";
import { UserId, type UserRole } from "@agds-hr/shared";

import { registerPolicies } from "./policies.ts";

const userWith = (roles: readonly UserRole[]): User => ({
  id: UserId("00000000-0000-4000-8000-000000000001"),
  email: "person@albertschool.com",
  roles,
  relationships: { reportsTo: [], manages: [] },
});

afterEach(() => {
  __resetPolicyRegistryForTests();
});

describe("composition root", () => {
  test("registers identity policies with adapted resources", () => {
    registerPolicies();
    expect(can(userWith(["developer"]), "identity.user.deactivate").allow).toBe(true);
    expect(can(userWith(["staff"]), "identity.user.deactivate").allow).toBe(false);
    expect(
      can(userWith(["developer"]), "identity.impersonation.start", {
        targetUserId: UserId("00000000-0000-4000-8000-000000000002"),
      }).allow,
    ).toBe(true);
  });

  test("is idempotent (safe under dev HMR) via the bootstrap probe", () => {
    registerPolicies();
    expect(() => registerPolicies()).not.toThrow();
    expect(can(userWith(["developer"]), POLICY_BOOTSTRAP_PROBE).allow).toBe(true);
  });

  test("unregistered actions still deny before registration", () => {
    expect(can(userWith(["developer"]), "identity.user.deactivate")).toEqual({
      allow: false,
      reason: "unregistered_action",
    });
  });
});
