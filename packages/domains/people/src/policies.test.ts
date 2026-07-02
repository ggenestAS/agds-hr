import { describe, expect, test } from "bun:test";

import type { User } from "@agds-hr/auth";
import { UserId, type UserRole } from "@agds-hr/shared";

import {
  canAdvanceReview,
  canManageEmployee,
  canOpenReview,
  canRateReview,
  canReadDirectory,
} from "./policies.ts";

const userWith = (roles: readonly UserRole[]): User => ({
  id: UserId("00000000-0000-4000-8000-000000000001"),
  email: "person@albertschool.com",
  roles,
  relationships: { reportsTo: [], manages: [] },
});

describe("people policies", () => {
  test("directory is readable by any authenticated user", () => {
    expect(canReadDirectory(userWith(["staff"])).allow).toBe(true);
  });

  test("employee attributes are HR-admin only (developer/admin)", () => {
    expect(canManageEmployee(userWith(["admin"])).allow).toBe(true);
    expect(canManageEmployee(userWith(["developer"])).allow).toBe(true);
    expect(canManageEmployee(userWith(["manager"])).allow).toBe(false);
    expect(canManageEmployee(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "hr_admin_required",
    });
  });

  test("opening a review needs review authority", () => {
    expect(canOpenReview(userWith(["manager"])).allow).toBe(true);
    expect(canOpenReview(userWith(["staff"])).allow).toBe(false);
  });

  test("advancing is stage-gated: manager assesses, only founders reach decision", () => {
    expect(canAdvanceReview(userWith(["manager"]), { toState: "manager_assessment" }).allow).toBe(
      true,
    );
    expect(canAdvanceReview(userWith(["manager"]), { toState: "decision" }).allow).toBe(false);
    expect(canAdvanceReview(userWith(["founder"]), { toState: "decision" }).allow).toBe(true);
    expect(canAdvanceReview(userWith(["staff"]), { toState: "calibration" }).allow).toBe(false);
  });

  test("rating is manager/founder, not admin or staff", () => {
    expect(canRateReview(userWith(["manager"])).allow).toBe(true);
    expect(canRateReview(userWith(["founder"])).allow).toBe(true);
    expect(canRateReview(userWith(["admin"])).allow).toBe(false);
    expect(canRateReview(userWith(["staff"])).allow).toBe(false);
  });
});
