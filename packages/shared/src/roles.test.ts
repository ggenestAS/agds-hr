import { describe, expect, test } from "bun:test";

import { LT_MEMBER_EMAILS, USER_ROLES, hasLtMemberRole, isUserRole } from "./roles.ts";

describe("role tuples", () => {
  test("the closed tuple holds the base roles plus the HR product roles", () => {
    expect(USER_ROLES).toEqual(["staff", "developer", "manager", "founder", "admin", "lt_member"]);
  });

  test("isUserRole guards against unknown strings", () => {
    expect(isUserRole("staff")).toBe(true);
    expect(isUserRole("founder")).toBe(true);
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("lt_member")).toBe(true);
    expect(isUserRole("")).toBe(false);
  });

  test("hasLtMemberRole detects the LT classification", () => {
    expect(hasLtMemberRole(["lt_member"])).toBe(true);
    expect(hasLtMemberRole(["manager", "lt_member"])).toBe(true);
    expect(hasLtMemberRole(["manager"])).toBe(false);
  });

  test("the canonical LT roster has twelve distinct emails", () => {
    expect(new Set(LT_MEMBER_EMAILS).size).toBe(12);
  });
});
