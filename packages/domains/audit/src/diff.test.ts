import { describe, expect, test } from "bun:test";

import { fieldDiff } from "./diff.ts";

describe("fieldDiff", () => {
  test("captures changed fields with before and after", () => {
    expect(fieldDiff({ name: "Ada", email: "a@b.co" }, { name: "Grace" })).toEqual({
      name: { before: "Ada", after: "Grace" },
    });
  });

  test("omits unchanged fields", () => {
    expect(fieldDiff({ name: "Ada" }, { name: "Ada" })).toEqual({});
  });

  test("captures fields that were previously absent", () => {
    expect(fieldDiff({}, { name: "Ada" })).toEqual({
      name: { before: undefined, after: "Ada" },
    });
  });

  test("compares structured values by content", () => {
    expect(fieldDiff({ tags: ["a"] }, { tags: ["a"] })).toEqual({});
    expect(fieldDiff({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual({
      tags: { before: ["a"], after: ["a", "b"] },
    });
  });

  test("only keys present in `after` are considered", () => {
    expect(fieldDiff({ name: "Ada", email: "a@b.co" }, {})).toEqual({});
  });
});
