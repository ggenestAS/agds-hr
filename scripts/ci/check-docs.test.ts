import { describe, expect, test } from "bun:test";

import { checkDecisions, checkPlans } from "./check-docs.ts";

const README = "| 2026-07-02 | [X](./2026-07-02-x.md) | frozen |";

describe("check-docs", () => {
  test("accepts a frozen, well-named, indexed decision", () => {
    expect(
      checkDecisions([{ name: "2026-07-02-x.md", firstLine: "Status: frozen" }], README),
    ).toEqual([]);
  });

  test("accepts a superseded status banner with a link", () => {
    expect(
      checkDecisions(
        [
          {
            name: "2026-07-02-x.md",
            firstLine: "Status: superseded by [Y](./2026-08-01-y.md)",
          },
        ],
        `${README} | [Y](./2026-08-01-y.md)`,
      ),
    ).toContainEqual("decisions/README.md indexes missing file 2026-08-01-y.md");
  });

  test("rejects a bad filename, missing banner, and missing index entry", () => {
    const errors = checkDecisions([{ name: "my-decision.md", firstLine: "# title" }], "");
    expect(errors).toHaveLength(3);
  });

  test("rejects an index entry whose file is gone", () => {
    const errors = checkDecisions([], README);
    expect(errors).toEqual(["decisions/README.md indexes missing file 2026-07-02-x.md"]);
  });

  test("accepts a plan with valid Status and Readiness", () => {
    expect(
      checkPlans([{ name: "payroll.md", content: "Status: planned\nReadiness: draft\n# p" }]),
    ).toEqual([]);
  });

  test("rejects a plan missing lifecycle fields", () => {
    const errors = checkPlans([{ name: "payroll.md", content: "# p" }]);
    expect(errors).toHaveLength(2);
  });

  test("rejects invalid Readiness values", () => {
    const errors = checkPlans([
      { name: "payroll.md", content: "Status: planned\nReadiness: soon\n" },
    ]);
    expect(errors).toEqual(['plans/payroll.md: missing a valid "Readiness:" field']);
  });
});
