import { describe, expect, test } from "bun:test";

import { findThemeViolations, isThemeScanned } from "./check-theme.ts";

describe("findThemeViolations", () => {
  test("flags a raw hex text color in an arbitrary value", () => {
    expect(
      findThemeViolations("r.tsx", `<span className="bg-coral text-[#5a2018]">low</span>`),
    ).toHaveLength(1);
  });

  test("flags short and 8-digit hex forms", () => {
    const content = `<i className="text-[#abc]" /><i className="bg-[#11223344]" />`;
    expect(findThemeViolations("r.tsx", content)).toHaveLength(2);
  });

  test("allows theme tokens and CSS variables", () => {
    const content = `<span className="bg-coral text-[var(--color-coral-text)] border-border">ok</span>`;
    expect(findThemeViolations("r.tsx", content)).toHaveLength(0);
  });

  test("allows rgba accent washes", () => {
    expect(
      findThemeViolations("r.tsx", `<a className="bg-[rgba(233,75,60,0.16)]">nav</a>`),
    ).toHaveLength(0);
  });
});

describe("isThemeScanned", () => {
  test("scans routes/components tsx, not server code", () => {
    expect(isThemeScanned("apps/web/src/routes/_app.dashboard.tsx")).toBe(true);
    expect(isThemeScanned("apps/web/src/components/frame.tsx")).toBe(true);
    expect(isThemeScanned("apps/web/src/server/session.functions.ts")).toBe(false);
  });
});
