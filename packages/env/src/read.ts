import type { ZodType } from "zod";

// Lazy, injectable env reads — nothing validates at import time; a feature's
// vars can be unset until the feature is exercised, then fail with a
// self-diagnosing error (docs/new-project-directives.md §11). Every reader
// takes `env: EnvSource = process.env` so tests inject fakes.
export type EnvSource = Record<string, string | undefined>;

export class EnvMissingError extends Error {
  constructor(public readonly variable: string) {
    super(
      `env_missing: ${variable} — set it in .env (see .env.example for what it is and how to obtain it)`,
    );
    this.name = "EnvMissingError";
  }
}

export class EnvInvalidError extends Error {
  constructor(
    public readonly variable: string,
    public readonly detail: string,
  ) {
    super(`env_invalid: ${variable} (${detail}) — see .env.example`);
    this.name = "EnvInvalidError";
  }
}

// Empty string = unset, everywhere: a blank line in .env must not count as
// configured.
export function readOptional(name: string, env: EnvSource = process.env): string | undefined {
  const value = env[name];
  return value === undefined || value === "" ? undefined : value;
}

export function readRequired(name: string, env: EnvSource = process.env): string {
  const value = readOptional(name, env);
  if (value === undefined) {
    throw new EnvMissingError(name);
  }
  return value;
}

export function isConfigured(names: readonly string[], env: EnvSource = process.env): boolean {
  return names.every((name) => readOptional(name, env) !== undefined);
}

export function readValidated<T>(
  name: string,
  schema: ZodType<T>,
  env: EnvSource = process.env,
): T {
  const raw = readRequired(name, env);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new EnvInvalidError(name, result.error.issues[0]?.message ?? "invalid");
  }
  return result.data;
}
