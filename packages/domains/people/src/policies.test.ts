import { describe, expect, test } from "bun:test";

import type { User } from "@agds-hr/auth";
import { UserId, type UserRole } from "@agds-hr/shared";

import {
  canAdvanceReview,
  canFileAppeal,
  canManageAppeals,
  canManageBands,
  canManageEmployee,
  canOpenReview,
  canRateReview,
  canReadDirectory,
  canSignDecision,
  canViewComp,
  canViewCompPrinciples,
  canViewSignoffQueue,
  canViewTracking,
} from "./policies.ts";

const userWith = (roles: readonly UserRole[]): User => ({
  id: UserId("00000000-0000-4000-8000-000000000001"),
  email: "person@albertschool.com",
  roles,
  relationships: { reportsTo: [], manages: [], localReportsTo: [], localManages: [] },
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

  test("signing a decision is founder-only (plus developer break-glass)", () => {
    expect(canSignDecision(userWith(["founder"])).allow).toBe(true);
    expect(canSignDecision(userWith(["admin"])).allow).toBe(false);
    expect(canSignDecision(userWith(["manager"])).allow).toBe(false);
  });

  test("compensation is leadership-only to view", () => {
    expect(canViewComp(userWith(["admin"])).allow).toBe(true);
    expect(canViewComp(userWith(["founder"])).allow).toBe(true);
    expect(canViewComp(userWith(["manager"])).allow).toBe(false);
    expect(canViewComp(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "comp_view_required",
    });
  });

  test("compensation principles (merit matrix) are open to managers too", () => {
    expect(canViewCompPrinciples(userWith(["manager"])).allow).toBe(true);
    expect(canViewCompPrinciples(userWith(["admin"])).allow).toBe(true);
    expect(canViewCompPrinciples(userWith(["founder"])).allow).toBe(true);
    expect(canViewCompPrinciples(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "comp_principles_view_required",
    });
  });

  test("filing an appeal is open to anyone (handler enforces ownership + window)", () => {
    expect(canFileAppeal(userWith(["staff"])).allow).toBe(true);
  });

  test("band figures are founder-editable only (plus developer break-glass)", () => {
    expect(canManageBands(userWith(["founder"])).allow).toBe(true);
    expect(canManageBands(userWith(["developer"])).allow).toBe(true);
    expect(canManageBands(userWith(["admin"])).allow).toBe(false);
    expect(canManageBands(userWith(["manager"])).allow).toBe(false);
    expect(canManageBands(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "founder_required",
    });
  });

  test("the tracking board is reviewer-facing (managers + leadership), never staff", () => {
    expect(canViewTracking(userWith(["manager"])).allow).toBe(true);
    expect(canViewTracking(userWith(["founder"])).allow).toBe(true);
    expect(canViewTracking(userWith(["admin"])).allow).toBe(true);
    expect(canViewTracking(userWith(["developer"])).allow).toBe(true);
    expect(canViewTracking(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "manager_required",
    });
  });

  test("the sign-off queue is leadership-only (admin/founder/developer)", () => {
    expect(canViewSignoffQueue(userWith(["admin"])).allow).toBe(true);
    expect(canViewSignoffQueue(userWith(["founder"])).allow).toBe(true);
    expect(canViewSignoffQueue(userWith(["developer"])).allow).toBe(true);
    expect(canViewSignoffQueue(userWith(["manager"])).allow).toBe(false);
    expect(canViewSignoffQueue(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "leadership_required",
    });
  });

  test("managing appeals is HR-admin only (admin/developer)", () => {
    expect(canManageAppeals(userWith(["admin"])).allow).toBe(true);
    expect(canManageAppeals(userWith(["developer"])).allow).toBe(true);
    expect(canManageAppeals(userWith(["founder"])).allow).toBe(false);
    expect(canManageAppeals(userWith(["staff"]))).toEqual({
      allow: false,
      reason: "appeals_admin_required",
    });
  });
});
