import { describe, expect, test } from "bun:test";

import { CAREER_LEVELS, CAREER_PATHS, isCareerLevel, isCareerPath } from "./types.ts";

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
