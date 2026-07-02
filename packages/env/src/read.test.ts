import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  EnvInvalidError,
  EnvMissingError,
  isConfigured,
  readOptional,
  readRequired,
  readValidated,
} from "./read.ts";

describe("env reads", () => {
  test("readOptional returns the value when set", () => {
    expect(readOptional("X", { X: "value" })).toBe("value");
  });

  test("readOptional treats empty string as unset", () => {
    expect(readOptional("X", { X: "" })).toBeUndefined();
    expect(readOptional("X", {})).toBeUndefined();
  });

  test("readRequired returns the value when set", () => {
    expect(readRequired("X", { X: "value" })).toBe("value");
  });

  test("readRequired throws a self-diagnosing error pointing at .env.example", () => {
    expect(() => readRequired("DATABASE_URL", {})).toThrow(EnvMissingError);
    expect(() => readRequired("DATABASE_URL", {})).toThrow("env_missing: DATABASE_URL");
    expect(() => readRequired("DATABASE_URL", {})).toThrow(".env.example");
  });

  test("isConfigured is true only when every name is set and non-empty", () => {
    expect(isConfigured(["A", "B"], { A: "1", B: "2" })).toBe(true);
    expect(isConfigured(["A", "B"], { A: "1", B: "" })).toBe(false);
    expect(isConfigured(["A", "B"], { A: "1" })).toBe(false);
    expect(isConfigured([], {})).toBe(true);
  });

  test("readValidated parses through the zod schema", () => {
    expect(readValidated("PORT", z.coerce.number(), { PORT: "3000" })).toBe(3000);
  });

  test("readValidated throws EnvMissingError when unset", () => {
    expect(() => readValidated("PORT", z.coerce.number(), {})).toThrow(EnvMissingError);
  });

  test("readValidated throws EnvInvalidError with the zod detail", () => {
    expect(() => readValidated("URL", z.url(), { URL: "not a url" })).toThrow(EnvInvalidError);
    expect(() => readValidated("URL", z.url(), { URL: "not a url" })).toThrow("env_invalid: URL");
  });
});
