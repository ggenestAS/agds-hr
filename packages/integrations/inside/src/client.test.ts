import { describe, expect, test } from "bun:test";

import {
  isInsideConfigured,
  listAdminDirectory,
  localTeamPeerCount,
  managementChain,
  type OrgNode,
} from "./client.ts";

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

describe("managementChain", () => {
  const node = (
    userId: string,
    functional: string | undefined,
    local?: string | undefined,
  ): OrgNode => ({
    userId,
    firstName: userId,
    lastName: "x",
    title: undefined,
    functionalManagerUserId: functional,
    localManagerUserId: local,
  });
  const nodes = [node("a", "b"), node("b", "c"), node("c", undefined)];

  test("walks the functional chain from immediate manager to the top", () => {
    expect(managementChain(nodes, "a").map((n) => n.userId)).toEqual(["b", "c"]);
    expect(managementChain(nodes, "c")).toHaveLength(0);
  });

  test("is cycle-guarded", () => {
    const cyclic = [node("a", "b"), node("b", "a")];
    expect(managementChain(cyclic, "a").map((n) => n.userId)).toEqual(["b"]);
  });
});

describe("localTeamPeerCount", () => {
  const node = (userId: string, local: string | undefined): OrgNode => ({
    userId,
    firstName: userId,
    lastName: "x",
    title: undefined,
    functionalManagerUserId: undefined,
    localManagerUserId: local,
  });

  test("counts other org nodes on the same local line", () => {
    const nodes = [node("solo", "mgr"), node("a", "mgr"), node("b", "mgr"), node("c", "other")];
    expect(localTeamPeerCount(nodes, "solo")).toBe(2);
    expect(localTeamPeerCount(nodes, "a")).toBe(2);
    expect(localTeamPeerCount(nodes, "c")).toBe(0);
  });

  test("returns 0 when the subject has no local manager", () => {
    expect(localTeamPeerCount([node("a", undefined)], "a")).toBe(0);
  });
});

describe("listOrgTree", () => {
  test("maps functional and local manager ids (null -> undefined)", async () => {
    const orgResponse = [
      {
        user_id: "u1",
        first_name: "Marie",
        last_name: "Curie",
        title: "Director",
        functional_manager_user_id: "u2",
        local_manager_user_id: "u3",
      },
    ];
    const fetchImpl = (async () =>
      new Response(JSON.stringify(orgResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const { listOrgTree } = await import("./client.ts");
    const nodes = await listOrgTree({ env: { INSIDE_API_KEY: "secret" }, fetchImpl });
    expect(nodes[0]).toMatchObject({
      userId: "u1",
      functionalManagerUserId: "u2",
      localManagerUserId: "u3",
    });
  });
});
