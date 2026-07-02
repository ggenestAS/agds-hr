import { describe, expect, test } from "bun:test";

import { isInsideConfigured, listAdminDirectory } from "./client.ts";

const RESPONSE = {
  total: 2,
  users: [
    {
      user_id: "u1",
      first_name: "Marie",
      last_name: "Curie",
      school_email: "marie.curie@albertschool.com",
      title: "Head of Admissions",
      campus_name: "Paris",
      country: "France",
      functional_manager_name: "Olivier Rodot",
      active: true,
    },
    {
      user_id: "u2",
      first_name: "Sam",
      last_name: "External",
      school_email: "sam@albertschool.com",
      title: null,
      campus_name: null,
      country: null,
      functional_manager_name: null,
      active: false,
    },
  ],
};

const fakeFetch = (calls: { url: string; headers: Record<string, string> }[]): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(RESPONSE), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

describe("inside client", () => {
  test("isInsideConfigured reflects the key (empty string = unset)", () => {
    expect(isInsideConfigured({ INSIDE_API_KEY: "secret" })).toBe(true);
    expect(isInsideConfigured({ INSIDE_API_KEY: "" })).toBe(false);
    expect(isInsideConfigured({})).toBe(false);
  });

  test("throws a self-diagnosing error when unconfigured", () => {
    expect(listAdminDirectory({ env: {} })).rejects.toThrow("inside_not_configured");
  });

  test("sends X-API-Key + role=ADMIN and maps the response (null -> undefined)", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const admins = await listAdminDirectory({
      env: { INSIDE_API_KEY: "secret" },
      fetchImpl: fakeFetch(calls),
      limit: 500,
    });

    expect(calls[0]?.headers["X-API-Key"]).toBe("secret");
    expect(calls[0]?.url).toContain("role=ADMIN");
    expect(calls[0]?.url).toContain("limit=500");

    expect(admins).toHaveLength(2);
    expect(admins[0]).toMatchObject({
      userId: "u1",
      email: "marie.curie@albertschool.com",
      title: "Head of Admissions",
      country: "France",
      functionalManagerName: "Olivier Rodot",
      active: true,
    });
    expect(admins[1]?.title).toBeUndefined();
    expect(admins[1]?.country).toBeUndefined();
    expect(admins[1]?.active).toBe(false);
  });

  test("throws on a non-ok response", () => {
    const failing = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    expect(
      listAdminDirectory({ env: { INSIDE_API_KEY: "secret" }, fetchImpl: failing }),
    ).rejects.toThrow("inside_request_failed");
  });
});
