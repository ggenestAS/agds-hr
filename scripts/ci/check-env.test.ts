import { describe, expect, test } from "bun:test";

import { checkEnv, extractCodeReads, extractExampleNames, isScanned } from "./check-env.ts";

describe("check-env", () => {
  test("extracts every recognized read form", () => {
    const content = `
      readRequired("A");
      readOptional("B", env);
      readValidated("C", schema);
      isConfigured(["D", "E"]);
      process.env.F;
      const table = { envVar: "G" };
    `;
    const names = extractCodeReads("x.ts", content).map((read) => read.name);
    expect(names.sort()).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  test("extracts variable names from .env.example, ignoring comments", () => {
    const content = "# comment\nDATABASE_URL=\n\n# more\nDATABASE_URL_ADMIN=value\nlowercase=x\n";
    expect(extractExampleNames(content)).toEqual(["DATABASE_URL", "DATABASE_URL_ADMIN"]);
  });

  test("passes when all three sources agree", () => {
    expect(
      checkEnv({
        manifestNames: ["A"],
        exampleNames: ["A"],
        codeReads: [{ name: "A", file: "x.ts" }],
      }),
    ).toEqual([]);
  });

  test("flags drift in every direction", () => {
    const errors = checkEnv({
      manifestNames: ["ONLY_MANIFEST", "SHARED"],
      exampleNames: ["ONLY_EXAMPLE", "SHARED"],
      codeReads: [
        { name: "SHARED", file: "x.ts" },
        { name: "ONLY_CODE", file: "y.ts" },
      ],
    });
    expect(errors).toContainEqual("ONLY_MANIFEST: in ENV_MANIFEST but missing from .env.example");
    expect(errors).toContainEqual(
      "ONLY_MANIFEST: in ENV_MANIFEST but never read in code — remove it",
    );
    expect(errors).toContainEqual("ONLY_EXAMPLE: in .env.example but missing from ENV_MANIFEST");
    expect(errors).toContainEqual("ONLY_CODE: read in y.ts but missing from ENV_MANIFEST");
  });

  test("excludes test files, ci/lib scripts, and env internals from scanning", () => {
    expect(isScanned("packages/db/src/client.ts")).toBe(true);
    expect(isScanned("packages/db/src/client.test.ts")).toBe(false);
    expect(isScanned("scripts/ci/check-env.ts")).toBe(false);
    expect(isScanned("scripts/lib/report.ts")).toBe(false);
    expect(isScanned("packages/env/src/read.ts")).toBe(false);
    expect(isScanned("drizzle.config.ts")).toBe(true);
  });
});
