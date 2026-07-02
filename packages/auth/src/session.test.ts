import { describe, expect, test } from "bun:test";

import { RequestId, UserId } from "@agds-hr/shared";

import { resolveSession } from "./session.ts";
import type { HydratedUser, SessionDeps } from "./types.ts";

const ACTOR_ID = UserId("00000000-0000-4000-8000-000000000001");
const SUBJECT_ID = UserId("00000000-0000-4000-8000-000000000002");
const FIXED_REQUEST_ID = RequestId("11111111-1111-4111-8111-111111111111");

const hydrated = (id: UserId, overrides: Partial<HydratedUser> = {}): HydratedUser => ({
  id,
  email: `${id}@albertschool.com`,
  roles: ["staff"],
  relationships: { reportsTo: [], manages: [] },
  deactivatedAt: null,
  ...overrides,
});

const deps = (overrides: Partial<SessionDeps> = {}): SessionDeps => ({
  readAuthSession: async () => ({ userId: ACTOR_ID, authSessionId: "auth-session-1" }),
  hydrateUser: async (id) => hydrated(id),
  readActiveImpersonation: async () => null,
  newRequestId: () => FIXED_REQUEST_ID,
  ...overrides,
});

const request = new Request("https://people.albertschool.com/");

describe("resolveSession", () => {
  test("no auth session -> null", async () => {
    const session = await resolveSession(request, deps({ readAuthSession: async () => null }));
    expect(session).toBeNull();
  });

  test("actor and subject are the same absent impersonation", async () => {
    const session = await resolveSession(request, deps());
    expect(session?.actor.id).toBe(ACTOR_ID);
    expect(session?.subject.id).toBe(ACTOR_ID);
    expect(session?.authSessionId).toBe("auth-session-1");
    expect(session?.requestId).toBe(FIXED_REQUEST_ID);
  });

  test("deactivated actor -> null (a valid cookie does not survive deactivation)", async () => {
    const session = await resolveSession(
      request,
      deps({ hydrateUser: async (id) => hydrated(id, { deactivatedAt: new Date() }) }),
    );
    expect(session).toBeNull();
  });

  test("missing actor -> null (fail closed)", async () => {
    const session = await resolveSession(request, deps({ hydrateUser: async () => undefined }));
    expect(session).toBeNull();
  });

  test("active impersonation sets subject to the impersonated user, actor unchanged", async () => {
    const session = await resolveSession(
      request,
      deps({ readActiveImpersonation: async () => SUBJECT_ID }),
    );
    expect(session?.actor.id).toBe(ACTOR_ID);
    expect(session?.subject.id).toBe(SUBJECT_ID);
  });

  test("impersonated subject that cannot be hydrated falls back to acting as self", async () => {
    const session = await resolveSession(
      request,
      deps({
        readActiveImpersonation: async () => SUBJECT_ID,
        hydrateUser: async (id) => (id === SUBJECT_ID ? undefined : hydrated(id)),
      }),
    );
    expect(session?.actor.id).toBe(ACTOR_ID);
    expect(session?.subject.id).toBe(ACTOR_ID);
  });

  test("the public session never exposes deactivatedAt", async () => {
    const session = await resolveSession(request, deps());
    expect(session?.actor).not.toHaveProperty("deactivatedAt");
  });
});
