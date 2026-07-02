import { describe, expect, test } from "bun:test";

import type { User } from "@agds-hr/auth";
import { UserId, type UserRole } from "@agds-hr/shared";

import { canManageEmployee, canReadDirectory } from "./policies.ts";

const userWith = (roles: readonly UserRole[]): User => ({
  id: UserId("00000000-0000-4000-8000-000000000001"),
  email: "person@albertschool.com",
  roles,
  relationships: { reportsTo: [], manages: [] },
});

describe("people policies", () => {
  test("directory is readable by any authenticated user (staff or developer)", () => {
    expect(canReadDirectory(userWith(["staff"])).allow).toBe(true);
    expect(canReadDirectory(userWith(["developer"])).allow).toBe(true);
  });

  test("managing employee attributes requires developer", () => {
    expect(canManageEmployee(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "developer_required",
    });
    expect(canManageEmployee(userWith(["developer"])).allow).toBe(true);
  });
});
