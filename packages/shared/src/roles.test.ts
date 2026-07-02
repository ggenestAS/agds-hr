import { describe, expect, test } from "bun:test";

import { USER_ROLES, isUserRole } from "./roles.ts";

describe("role tuples", () => {
  test("the closed tuple contains staff and developer", () => {
    expect(USER_ROLES).toEqual(["staff", "developer"]);
  });

  test("isUserRole guards against unknown strings", () => {
    expect(isUserRole("staff")).toBe(true);
    expect(isUserRole("developer")).toBe(true);
    expect(isUserRole("admin")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });
});
