import { describe, expect, test } from "bun:test";

import {
  CAREER_LEVELS,
  CAREER_PATHS,
  canTransition,
  isCareerLevel,
  isCareerPath,
  isReviewRating,
  isReviewState,
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
});
