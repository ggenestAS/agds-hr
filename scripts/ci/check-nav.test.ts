import { describe, expect, test } from "bun:test";

import { findNavViolations, isNavScanned } from "./check-nav.ts";

describe("findNavViolations", () => {
  test("flags onClick that calls navigate", () => {
    expect(
      findNavViolations("r.tsx", `<button onClick={() => navigate({ to: "/x" })}>go</button>`),
    ).toHaveLength(1);
  });

  test("flags an inline block handler calling navigate", () => {
    expect(
      findNavViolations("r.tsx", `<button onClick={() => { navigate({ to: "/x" }); }}>go</button>`),
    ).toHaveLength(1);
  });

  test("allows a Link anchor", () => {
    expect(findNavViolations("r.tsx", `<Link to="/x">go</Link>`)).toHaveLength(0);
  });

  test("allows programmatic navigate outside an onClick", () => {
    expect(
      findNavViolations(
        "r.tsx",
        `const submit = async () => { await save(); navigate({ to: "/x" }); };`,
      ),
    ).toHaveLength(0);
  });

  test("allows an onClick that does not navigate", () => {
    expect(
      findNavViolations("r.tsx", `<button onClick={() => setOpen(true)}>open</button>`),
    ).toHaveLength(0);
  });
});

describe("isNavScanned", () => {
  test("scans routes/components tsx, not api or server", () => {
    expect(isNavScanned("apps/web/src/routes/_app.dashboard.tsx")).toBe(true);
    expect(isNavScanned("apps/web/src/components/frame.tsx")).toBe(true);
    expect(isNavScanned("apps/web/src/routes/api/auth.$.ts")).toBe(false);
    expect(isNavScanned("apps/web/src/server/session.functions.ts")).toBe(false);
  });
});
