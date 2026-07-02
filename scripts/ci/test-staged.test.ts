import { describe, expect, test } from "bun:test";

import { affectedRoots } from "./test-staged.ts";

describe("test-staged affected roots", () => {
  test("maps package files to their package root", () => {
    expect(
      affectedRoots([
        "packages/shared/src/brand.ts",
        "packages/shared/src/errors.ts",
        "packages/env/src/read.ts",
      ]),
    ).toEqual(["packages/env", "packages/shared"]);
  });

  test("domain and integration packages are one level deeper", () => {
    expect(affectedRoots(["packages/domains/audit/src/dal.ts"])).toEqual([
      "packages/domains/audit",
    ]);
    expect(affectedRoots(["packages/integrations/resend/src/client.ts"])).toEqual([
      "packages/integrations/resend",
    ]);
  });

  test("script files map to the scripts tree, non-ts files are ignored", () => {
    expect(affectedRoots(["scripts/ci/check-env.ts", "docs/CHARTER.md", "lefthook.yml"])).toEqual([
      "scripts",
    ]);
  });

  test("a bare package.json path does not select a package", () => {
    expect(affectedRoots(["packages/shared"])).toEqual([]);
  });
});
