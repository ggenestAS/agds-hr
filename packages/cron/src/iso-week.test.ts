import { describe, expect, test } from "bun:test";

import { isoWeekKey } from "./iso-week.ts";

describe("isoWeekKey", () => {
  test("a mid-year Monday", () => {
    // 2026-07-06 is a Monday in W28.
    expect(isoWeekKey(new Date("2026-07-06T07:00:00Z"))).toBe("2026-W28");
  });

  test("Jan 1 belonging to the prior ISO year", () => {
    // 2027-01-01 is a Friday — its week's Thursday is 2026-12-31 → 2026-W53.
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  test("late December belonging to the next ISO year", () => {
    // 2025-12-29 is a Monday — its week's Thursday is 2026-01-01 → 2026-W01.
    expect(isoWeekKey(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
  });

  test("consecutive Mondays land in consecutive weeks", () => {
    expect(isoWeekKey(new Date("2026-07-06T07:00:00Z"))).not.toBe(
      isoWeekKey(new Date("2026-07-13T07:00:00Z")),
    );
  });
});
