import { describe, expect, test } from "bun:test";

import { ENV_MANIFEST } from "./manifest.ts";

describe("env manifest", () => {
  test("names are unique", () => {
    const names = ENV_MANIFEST.map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every owner is a workspace package", () => {
    for (const spec of ENV_MANIFEST) {
      expect(spec.owner).toStartWith("@agds-hr/");
    }
  });

  test("names are SCREAMING_SNAKE_CASE", () => {
    for (const spec of ENV_MANIFEST) {
      expect(spec.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
