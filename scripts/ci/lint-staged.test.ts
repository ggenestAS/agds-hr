import { describe, expect, test } from "bun:test";

import { reverseImportClosure } from "./lint-staged.ts";

describe("lint-staged reverse import closure", () => {
  const files = new Map<string, string>([
    ["packages/shared/src/brand.ts", "export const x = 1;"],
    ["packages/shared/src/index.ts", 'export { UserId } from "./brand.ts";'],
    ["packages/db/src/client.ts", 'import { readRequired } from "@agds-hr/env";'],
  ]);

  test("includes staged files and their direct importers", () => {
    const closure = reverseImportClosure(["packages/shared/src/brand.ts"], files);
    expect(closure.sort()).toEqual([
      "packages/shared/src/brand.ts",
      "packages/shared/src/index.ts",
    ]);
  });

  test("is 1-hop only — package-specifier imports are not chased", () => {
    const closure = reverseImportClosure(["packages/env/src/read.ts"], files);
    expect(closure).toEqual(["packages/env/src/read.ts"]);
  });

  test("does not duplicate a staged importer", () => {
    const closure = reverseImportClosure(
      ["packages/shared/src/brand.ts", "packages/shared/src/index.ts"],
      files,
    );
    expect(closure.sort()).toEqual([
      "packages/shared/src/brand.ts",
      "packages/shared/src/index.ts",
    ]);
  });
});
