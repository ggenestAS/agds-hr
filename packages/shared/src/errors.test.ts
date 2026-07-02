import { describe, expect, test } from "bun:test";

import { ConflictError, ForbiddenError, NotFoundError, UniqueViolationError } from "./errors.ts";

describe("shared errors", () => {
  test("ForbiddenError carries action and reason, message is machine-parseable", () => {
    const error = new ForbiddenError("identity.profile.update", "staff_required");
    expect(error.message).toBe("forbidden: identity.profile.update (staff_required)");
    expect(error.action).toBe("identity.profile.update");
    expect(error.reason).toBe("staff_required");
    expect(error.name).toBe("ForbiddenError");
    expect(error).toBeInstanceOf(Error);
  });

  test("NotFoundError formats resource#id", () => {
    const error = new NotFoundError("user", "u-1");
    expect(error.message).toBe("not_found: user#u-1");
    expect(error.resource).toBe("user");
    expect(error.id).toBe("u-1");
    expect(error.name).toBe("NotFoundError");
  });

  test("ConflictError formats its reason", () => {
    const error = new ConflictError("already_active");
    expect(error.message).toBe("conflict: already_active");
    expect(error.reason).toBe("already_active");
    expect(error.name).toBe("ConflictError");
  });

  test("UniqueViolationError formats constraint(value)", () => {
    const error = new UniqueViolationError("user_email_unique", "g@a.com");
    expect(error.message).toBe("unique_violation: user_email_unique(g@a.com)");
    expect(error.constraint).toBe("user_email_unique");
    expect(error.value).toBe("g@a.com");
    expect(error.name).toBe("UniqueViolationError");
  });
});
