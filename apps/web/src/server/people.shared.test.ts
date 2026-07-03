import { describe, expect, test } from "bun:test";

import type { SelfReviewKey } from "./people.shared.ts";
import {
  SELF_REVIEW_KEYS,
  SELF_REVIEW_KPI_ROWS,
  SELF_REVIEW_KPIS_MAX,
  SELF_REVIEW_OBJECTIVE_ROWS,
  SELF_REVIEW_OBJECTIVES_MAX,
  SELF_REVIEW_OBJECTIVES_MIN,
  SELF_REVIEW_WORD_BOUNDS,
  countWords,
  formatSelfReviewRole,
  kpiRowsInUse,
  objectiveRowsInUse,
  peerTabBadges,
  selfReviewSubmitIssues,
  stampSelfReviewHeader,
} from "./people.shared.ts";

const words = (count: number) => Array.from({ length: count }, (_, i) => `w${i}`).join(" ");

// A payload that passes the submit gate: two complete objectives with results
// inside the word bounds, nothing else touched.
const validPayload = (): Partial<Record<SelfReviewKey, string>> => ({
  o1_obj: "Own the admissions funnel",
  o1_target: "90% of applications processed within 5 days",
  o1_result: words(40),
  o2_obj: "Run the 2026 budget cycle",
  o2_target: "Budget signed before June",
  o2_result: words(40),
});

describe("countWords", () => {
  test("empty and whitespace-only strings count zero", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });

  test("splits on any whitespace run", () => {
    expect(countWords("one two  three\nfour")).toBe(4);
    expect(countWords("  padded  ")).toBe(1);
  });
});

describe("self-review row slots", () => {
  test("row tuples match the configured maxima and live inside the closed key set", () => {
    expect(SELF_REVIEW_OBJECTIVE_ROWS.length).toBe(SELF_REVIEW_OBJECTIVES_MAX);
    expect(SELF_REVIEW_KPI_ROWS.length).toBe(SELF_REVIEW_KPIS_MAX);
    const keys = SELF_REVIEW_KEYS as readonly string[];
    for (const row of SELF_REVIEW_OBJECTIVE_ROWS) {
      expect(keys).toContain(row.obj);
      expect(keys).toContain(row.target);
      expect(keys).toContain(row.result);
    }
    for (const row of SELF_REVIEW_KPI_ROWS) {
      expect(keys).toContain(row.name);
      expect(keys).toContain(row.target);
      expect(keys).toContain(row.actual);
      expect(keys).toContain(row.reading);
    }
  });

  test("every word-bounded key is a real self-review key", () => {
    const keys = SELF_REVIEW_KEYS as readonly string[];
    for (const key of Object.keys(SELF_REVIEW_WORD_BOUNDS)) {
      expect(keys).toContain(key);
    }
  });

  test("rows-in-use reads the highest slot carrying content", () => {
    expect(objectiveRowsInUse({})).toBe(0);
    expect(objectiveRowsInUse({ o4_obj: "later slot" })).toBe(4);
    expect(kpiRowsInUse({})).toBe(0);
    expect(kpiRowsInUse({ k3_reading: "only the reading" })).toBe(3);
  });
});

describe("selfReviewSubmitIssues", () => {
  test("a payload with two complete, in-bounds objectives passes", () => {
    expect(selfReviewSubmitIssues(validPayload())).toEqual([]);
  });

  test("an empty payload fails the minimum-objectives rule", () => {
    const issues = selfReviewSubmitIssues({});
    expect(issues.some((issue) => issue.includes(`${SELF_REVIEW_OBJECTIVES_MIN} complete`))).toBe(
      true,
    );
  });

  test("a partially filled objective is flagged and does not count as complete", () => {
    const payload = { ...validPayload(), o3_obj: "named but no target or result" };
    const issues = selfReviewSubmitIssues(payload);
    expect(issues.some((issue) => issue.includes("Objective 3"))).toBe(true);
  });

  test("one complete objective is not enough", () => {
    const payload = validPayload();
    delete payload.o2_obj;
    delete payload.o2_target;
    delete payload.o2_result;
    const issues = selfReviewSubmitIssues(payload);
    expect(issues.some((issue) => issue.includes("1 so far"))).toBe(true);
  });

  test("KPIs are optional but a touched row must be complete", () => {
    expect(selfReviewSubmitIssues(validPayload())).toEqual([]);
    const partial = { ...validPayload(), k1_name: "Retention" };
    expect(selfReviewSubmitIssues(partial).some((issue) => issue.includes("KPI 1"))).toBe(true);
    const complete = {
      ...validPayload(),
      k1_name: "Retention",
      k1_target: "92%",
      k1_actual: "94%",
    };
    expect(selfReviewSubmitIssues(complete)).toEqual([]);
  });

  test("a filled bounded field below its word minimum is flagged", () => {
    const payload = { ...validPayload(), d_proud: "too short" };
    const issues = selfReviewSubmitIssues(payload);
    expect(issues.some((issue) => issue.includes("Most proud of"))).toBe(true);
  });

  test("a filled bounded field above its word maximum is flagged", () => {
    const payload = { ...validPayload(), o1_result: words(200) };
    const issues = selfReviewSubmitIssues(payload);
    expect(issues.some((issue) => issue.includes("Objective 1 · result"))).toBe(true);
  });

  test("empty bounded fields are not flagged — required-ness is the row rules' job", () => {
    expect(selfReviewSubmitIssues({ ...validPayload(), d_proud: "" })).toEqual([]);
  });
});

describe("formatSelfReviewRole", () => {
  test("joins title, level meta, and path", () => {
    expect(formatSelfReviewRole({ title: "Head of Ops", level: "L3", path: "manager" })).toBe(
      "Head of Ops · L3 · Lead · Management",
    );
  });

  test("returns em dash when nothing is assigned", () => {
    expect(formatSelfReviewRole({ title: undefined, level: undefined, path: undefined })).toBe("—");
  });
});

describe("stampSelfReviewHeader", () => {
  test("overwrites client header keys with server context", () => {
    const stamped = stampSelfReviewHeader(
      { ...validPayload(), sr_name: "wrong", sr_period: "wrong period" },
      {
        name: "Ada Lovelace",
        role: "Engineer · L2 · Owner · IC",
        manager: "Charles Babbage",
        period: "Sep 2025 – Aug 2026",
      },
    );
    expect(stamped.sr_name).toBe("Ada Lovelace");
    expect(stamped.sr_period).toBe("Sep 2025 – Aug 2026");
    expect(stamped.o1_obj).toBe("Own the admissions funnel");
  });
});

describe("peerTabBadges", () => {
  test("give tab counts pending requests; team tab counts proposed on reports", () => {
    const badges = peerTabBadges({
      requestsForYou: [{ status: "pending" }, { status: "submitted" }, { status: "proposed" }],
      cases: [
        { requests: [{ status: "proposed" }, { status: "submitted" }] },
        { requests: [{ status: "pending" }] },
      ],
      isReviewer: true,
    });
    expect(badges).toEqual({ mine: 0, give: 1, team: 1 });
  });

  test("non-reviewers only see the give tab badge", () => {
    const badges = peerTabBadges({
      requestsForYou: [{ status: "pending" }],
      cases: [{ requests: [{ status: "proposed" }] }],
      isReviewer: false,
    });
    expect(badges).toEqual({ mine: 0, give: 1, team: 0 });
  });
});
