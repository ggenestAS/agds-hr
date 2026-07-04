import { afterEach, describe, expect, test } from "bun:test";

import {
  __resetCronRegistryForTests,
  getCronJob,
  listCronJobIds,
  registerCronJob,
} from "./registry.ts";

afterEach(() => {
  __resetCronRegistryForTests();
});

describe("cron registry", () => {
  test("registered jobs are retrievable and listable", async () => {
    registerCronJob({ id: "noop", run: () => Promise.resolve({ ok: true }) });
    expect(listCronJobIds()).toEqual(["noop"]);
    expect(await getCronJob("noop")?.run()).toEqual({ ok: true });
  });

  test("an unknown id resolves to undefined (deny by default)", () => {
    expect(getCronJob("missing")).toBeUndefined();
  });

  test("double registration throws", () => {
    registerCronJob({ id: "dup", run: () => Promise.resolve({}) });
    expect(() => registerCronJob({ id: "dup", run: () => Promise.resolve({}) })).toThrow(
      "cron_job_already_registered: dup",
    );
  });
});
