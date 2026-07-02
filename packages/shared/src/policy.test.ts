import { describe, expect, test } from "bun:test";

import { ALLOW, DENY } from "./policy.ts";

describe("policy decisions", () => {
  test("ALLOW is the shared allow value", () => {
    expect(ALLOW).toEqual({ allow: true });
  });

  test("DENY carries a snake_case reason", () => {
    expect(DENY("staff_required")).toEqual({
      allow: false,
      reason: "staff_required",
    });
  });
});
