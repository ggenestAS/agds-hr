import { describe, expect, test } from "bun:test";

import {
  bandPositionPct,
  bandThird,
  CAREER_LEVELS,
  CAREER_PATHS,
  canTransition,
  isCareerLevel,
  isCareerPath,
  isDecisionComplete,
  isP6Triggered,
  isReviewRating,
  isReviewState,
  meritIncreaseBp,
} from "./types.ts";

describe("job architecture tuples", () => {
  test("four levels, two paths", () => {
    expect(CAREER_LEVELS).toHaveLength(4);
    expect(CAREER_PATHS).toEqual(["ic", "manager"]);
  });

  test("guards accept members and reject non-members", () => {
    expect(isCareerLevel("L3")).toBe(true);
    expect(isCareerLevel("P5")).toBe(false);
    expect(isCareerPath("manager")).toBe(true);
    expect(isCareerPath("director")).toBe(false);
  });
});

describe("review state machine", () => {
  test("valid forward transitions and the appeal branch are allowed", () => {
    expect(canTransition("self_review", "manager_assessment")).toBe(true);
    expect(canTransition("manager_assessment", "calibration")).toBe(true);
    expect(canTransition("calibration", "decision")).toBe(true);
    expect(canTransition("decision", "appeal")).toBe(true);
    expect(canTransition("decision", "closed")).toBe(true);
  });

  test("illegal transitions are rejected (no skipping, no going back)", () => {
    expect(canTransition("self_review", "decision")).toBe(false);
    expect(canTransition("calibration", "self_review")).toBe(false);
    expect(canTransition("closed", "appeal")).toBe(false);
  });

  test("state and rating guards", () => {
    expect(isReviewState("calibration")).toBe(true);
    expect(isReviewState("bogus")).toBe(false);
    expect(isReviewRating(4)).toBe(true);
    expect(isReviewRating(5)).toBe(false);
  });

  test("a decision completes only at two distinct sign-offs", () => {
    expect(isDecisionComplete(0)).toBe(false);
    expect(isDecisionComplete(1)).toBe(false);
    expect(isDecisionComplete(2)).toBe(true);
    expect(isDecisionComplete(3)).toBe(true);
  });

  test("P6 is triggered for ratings 1–2 only", () => {
    expect(isP6Triggered(1)).toBe(true);
    expect(isP6Triggered(2)).toBe(true);
    expect(isP6Triggered(3)).toBe(false);
    expect(isP6Triggered(4)).toBe(false);
    expect(isP6Triggered(undefined)).toBe(false);
  });
});

describe("compensation", () => {
  test("band position clamps to 0–100 and handles a degenerate band", () => {
    expect(bandPositionPct(50_000, 40_000, 60_000)).toBe(50);
    expect(bandPositionPct(30_000, 40_000, 60_000)).toBe(0);
    expect(bandPositionPct(70_000, 40_000, 60_000)).toBe(100);
    expect(bandPositionPct(50_000, 60_000, 60_000)).toBe(50);
  });

  test("band thirds split at 34 and 67", () => {
    expect(bandThird(10)).toBe("low");
    expect(bandThird(50)).toBe("mid");
    expect(bandThird(90)).toBe("high");
  });

  test("merit is guide-not-formula: low-in-band + top rating earns most; rating 1 nothing", () => {
    expect(meritIncreaseBp(4, 10)).toBeGreaterThan(meritIncreaseBp(4, 90));
    expect(meritIncreaseBp(4, 10)).toBeGreaterThan(meritIncreaseBp(3, 10));
    expect(meritIncreaseBp(1, 10)).toBe(0);
  });
});
