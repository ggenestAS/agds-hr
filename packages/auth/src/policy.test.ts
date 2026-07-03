import { afterEach, describe, expect, test } from "bun:test";

import { ALLOW, DENY, ForbiddenError, UserId } from "@agds-hr/shared";

import {
  assertCan,
  can,
  isPolicyRegistered,
  registerPolicy,
  __resetPolicyRegistryForTests,
} from "./policy.ts";
import type { User } from "./types.ts";

const user: User = {
  id: UserId("00000000-0000-4000-8000-000000000001"),
  email: "person@albertschool.com",
  roles: ["staff"],
  relationships: { reportsTo: [], manages: [], localReportsTo: [], localManages: [] },
};

afterEach(() => {
  __resetPolicyRegistryForTests();
});

describe("policy registry", () => {
  test("unregistered action denies with unregistered_action", () => {
    expect(can(user, "identity.profile.update")).toEqual(DENY("unregistered_action"));
  });

  test("registered handler drives the decision", () => {
    registerPolicy("identity.profile.update", () => ALLOW);
    expect(can(user, "identity.profile.update")).toEqual(ALLOW);
  });

  test("double registration throws", () => {
    registerPolicy("identity.profile.update", () => ALLOW);
    expect(() => registerPolicy("identity.profile.update", () => ALLOW)).toThrow(
      "policy_double_registration: identity.profile.update",
    );
  });

  test("isPolicyRegistered reflects registration", () => {
    expect(isPolicyRegistered("identity.profile.update")).toBe(false);
    registerPolicy("identity.profile.update", () => ALLOW);
    expect(isPolicyRegistered("identity.profile.update")).toBe(true);
  });

  test("assertCan throws ForbiddenError carrying action + reason on deny", () => {
    registerPolicy("identity.user.deactivate", () => DENY("developer_required"));
    expect(() => assertCan(user, "identity.user.deactivate")).toThrow(ForbiddenError);
    try {
      assertCan(user, "identity.user.deactivate");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).action).toBe("identity.user.deactivate");
      expect((error as ForbiddenError).reason).toBe("developer_required");
    }
  });

  test("assertCan passes silently on allow", () => {
    registerPolicy("identity.profile.update", () => ALLOW);
    expect(() => assertCan(user, "identity.profile.update")).not.toThrow();
  });
});
