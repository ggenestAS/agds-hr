import { describe, expect, test } from "bun:test";

import { isWorkspaceDomainAllowed, WORKSPACE_ALLOWED_DOMAINS } from "./auth.ts";

// getAuth() is a lazy BetterAuth seam exercised only with live OAuth creds and
// a running server (step 6); the security boundary that is pure — the workspace
// allow-list guard — is unit tested here.
describe("workspace allow-list", () => {
  test("allows a workspace domain on the list", () => {
    expect(isWorkspaceDomainAllowed("albertschool.com")).toBe(true);
  });

  test("rejects a domain off the list", () => {
    expect(isWorkspaceDomainAllowed("gmail.com")).toBe(false);
  });

  test("rejects missing or empty hosted domain", () => {
    expect(isWorkspaceDomainAllowed(null)).toBe(false);
    expect(isWorkspaceDomainAllowed(undefined)).toBe(false);
    expect(isWorkspaceDomainAllowed("")).toBe(false);
  });

  test("the allow-list is the single hardcoded source", () => {
    expect(WORKSPACE_ALLOWED_DOMAINS).toContain("albertschool.com");
  });
});
