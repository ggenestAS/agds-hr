import type { OrgNode } from "@agds-hr/inside";
import { describe, expect, test } from "bun:test";

import { directReportCountsByManagerId } from "./roles.shared.ts";

const node = (
  userId: string,
  functionalManagerUserId?: string,
  localManagerUserId?: string,
): OrgNode => ({
  userId,
  firstName: userId,
  lastName: "Test",
  title: undefined,
  functionalManagerUserId,
  localManagerUserId,
});

describe("directReportCountsByManagerId", () => {
  test("counts functional and local direct reports", () => {
    const counts = directReportCountsByManagerId([
      node("report-a", "functional-boss"),
      node("report-b", undefined, "local-boss"),
      node("report-c", "functional-boss", "local-boss"),
    ]);
    expect(counts.get("functional-boss")).toBe(2);
    expect(counts.get("local-boss")).toBe(2);
  });

  test("dedupes when both lines point to the same manager", () => {
    const counts = directReportCountsByManagerId([node("report-a", "same-boss", "same-boss")]);
    expect(counts.get("same-boss")).toBe(1);
  });
});
