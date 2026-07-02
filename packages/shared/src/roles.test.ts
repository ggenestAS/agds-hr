import { describe, expect, test } from "bun:test";

import { USER_ROLES, isUserRole } from "./roles.ts";

describe("role tuples", () => {
  test("the closed tuple holds the base roles plus the HR product roles", () => {
    expect(USER_ROLES).toEqual(["staff", "developer", "manager", "founder", "admin"]);
  });

  test("isUserRole guards against unknown strings", () => {
    expect(isUserRole("staff")).toBe(true);
    expect(isUserRole("founder")).toBe(true);
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("lt_member")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });
});
