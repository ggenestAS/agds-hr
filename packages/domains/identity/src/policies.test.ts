import { describe, expect, test } from "bun:test";

import type { User } from "@agds-hr/auth";
import { UserId, type UserRole } from "@agds-hr/shared";

import {
  canDeactivateUser,
  canGrantRole,
  canStartImpersonation,
  canUpdateProfile,
} from "./policies.ts";

const SELF = UserId("00000000-0000-4000-8000-000000000001");
const OTHER = UserId("00000000-0000-4000-8000-000000000002");

const userWith = (roles: readonly UserRole[], id: UserId = SELF): User => ({
  id,
  email: "person@albertschool.com",
  roles,
  relationships: { reportsTo: [], manages: [] },
});

describe("identity policies", () => {
  test("profile update: owner allowed, non-owner staff denied, developer allowed", () => {
    expect(canUpdateProfile(userWith(["staff"]), { userId: SELF }).allow).toBe(true);
    expect(canUpdateProfile(userWith(["staff"]), { userId: OTHER }).allow).toBe(false);
    expect(canUpdateProfile(userWith(["developer"]), { userId: OTHER }).allow).toBe(true);
  });

  test("deactivate and grant require developer", () => {
    expect(canDeactivateUser(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "developer_required",
    });
    expect(canDeactivateUser(userWith(["developer"])).allow).toBe(true);
    expect(canGrantRole(userWith(["staff"])).allow).toBe(false);
    expect(canGrantRole(userWith(["developer"])).allow).toBe(true);
  });

  test("impersonation requires developer and forbids targeting self", () => {
    expect(canStartImpersonation(userWith(["staff"]), { targetUserId: OTHER })).toEqual({
      allow: false,
      reason: "developer_required",
    });
    expect(canStartImpersonation(userWith(["developer"]), { targetUserId: SELF })).toEqual({
      allow: false,
      reason: "cannot_impersonate_self",
    });
    expect(canStartImpersonation(userWith(["developer"]), { targetUserId: OTHER }).allow).toBe(
      true,
    );
  });
});
