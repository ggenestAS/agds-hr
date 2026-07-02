import { describe, expect, test } from "bun:test";

import { isThemePreference, resolveDark, THEME_STORAGE_KEY } from "./theme.ts";

describe("theme resolution", () => {
  test("explicit dark/light win regardless of system", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
  });

  test("system (or unset/invalid) follows the OS preference", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
    expect(resolveDark(null, true)).toBe(true);
    expect(resolveDark("bogus", true)).toBe(true);
    expect(resolveDark(null, false)).toBe(false);
  });

  test("isThemePreference guards the closed set", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
  });

  test("storage key is stable (the FOUC script depends on it)", () => {
    expect(THEME_STORAGE_KEY).toBe("agds-hr-theme");
  });
});
