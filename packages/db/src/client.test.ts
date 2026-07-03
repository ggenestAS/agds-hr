import { afterEach, describe, expect, test } from "bun:test";

import { EnvMissingError } from "@agds-hr/env";

import { __resetDbForTests, getDbAs, runWithRequestDbScope } from "./client.ts";

const FAKE_ENV = {
  DATABASE_URL: "postgres://app_role:x@localhost:5432/agds_hr",
  DATABASE_URL_ADMIN: "postgres://admin_role:x@localhost:5432/agds_hr",
  DATABASE_URL_READONLY: "postgres://readonly_role:x@localhost:5432/agds_hr",
  DATABASE_URL_WEBHOOK: "postgres://webhook_role:x@localhost:5432/agds_hr",
};

// postgres.js opens connections lazily, so constructing clients against a
// non-existent host is safe here — nothing connects until a query runs.
describe("getDbAs", () => {
  afterEach(async () => {
    await __resetDbForTests();
  });

  test("throws a self-diagnosing EnvMissingError when the role's URL is unset", () => {
    expect(() => getDbAs("app", {})).toThrow(EnvMissingError);
    expect(() => getDbAs("admin", {})).toThrow("env_missing: DATABASE_URL_ADMIN");
    expect(() => getDbAs("readonly", {})).toThrow("env_missing: DATABASE_URL_READONLY");
    expect(() => getDbAs("webhook", {})).toThrow("env_missing: DATABASE_URL_WEBHOOK");
  });

  test("memoizes one drizzle instance per role", () => {
    const first = getDbAs("app", FAKE_ENV);
    expect(getDbAs("app", FAKE_ENV)).toBe(first);
    expect(getDbAs("admin", FAKE_ENV)).not.toBe(first);
  });

  test("__resetDbForTests clears the memo", async () => {
    const first = getDbAs("app", FAKE_ENV);
    await __resetDbForTests();
    expect(getDbAs("app", FAKE_ENV)).not.toBe(first);
  });

  // Workers cannot reuse sockets across requests, so each request scope must
  // get its own client — and never see (or pollute) the process-level memo.
  test("runWithRequestDbScope isolates clients per scope", () => {
    const processDb = getDbAs("app", FAKE_ENV);
    const scopedA = runWithRequestDbScope(() => {
      const db = getDbAs("app", FAKE_ENV);
      expect(getDbAs("app", FAKE_ENV)).toBe(db);
      return db;
    });
    const scopedB = runWithRequestDbScope(() => getDbAs("app", FAKE_ENV));
    expect(scopedA).not.toBe(processDb);
    expect(scopedA).not.toBe(scopedB);
    expect(getDbAs("app", FAKE_ENV)).toBe(processDb);
  });
});
