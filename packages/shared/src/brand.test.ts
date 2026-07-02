import { describe, expect, test } from "bun:test";

import { AuditEventId, Email, RequestId, UserId } from "./brand.ts";

describe("branded ids", () => {
  test("constructors are plain casts preserving the string", () => {
    expect(UserId("u-1")).toBe("u-1" as ReturnType<typeof UserId>);
    expect(RequestId("r-1")).toBe("r-1" as ReturnType<typeof RequestId>);
    expect(AuditEventId("a-1")).toBe("a-1" as ReturnType<typeof AuditEventId>);
  });

  test("Email validates and returns the input", () => {
    expect(Email("g@albertschool.com")).toBe("g@albertschool.com" as ReturnType<typeof Email>);
  });

  test("Email throws a snake_case-prefixed error on invalid input", () => {
    expect(() => Email("not-an-email")).toThrow("invalid_email: not-an-email");
    expect(() => Email("a b@c.d")).toThrow("invalid_email:");
    expect(() => Email("a@b")).toThrow("invalid_email:");
    expect(() => Email("")).toThrow("invalid_email:");
  });
});
