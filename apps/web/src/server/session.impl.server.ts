import { getRequest } from "@tanstack/react-start/server";

import { getAuth, resolveSession, type Session, type SessionDeps } from "@agds-hr/auth";
import { getDbAs } from "@agds-hr/db";
import { hydrateUser, readActiveImpersonation } from "@agds-hr/identity";
import { RequestId, UserId } from "@agds-hr/shared";

import { registerPolicies } from "./policies.ts";

// Server-only session resolution. The injected SessionDeps wire the auth-session
// read (BetterAuth) and hydration (identity) that resolveSession is agnostic to
// (docs/decisions/2026-07-02-auth-identity-session-and-policy.md). Session
// resolution is privileged, so hydration runs on the admin connection (it reads
// auth.user.email, which runtime roles cannot — §6.1).
function sessionDeps(): SessionDeps {
  const adminDb = getDbAs("admin");
  return {
    readAuthSession: async (request) => {
      const result = await getAuth().api.getSession({ headers: request.headers });
      if (result === null) {
        return null;
      }
      return { userId: UserId(result.user.id), authSessionId: result.session.id };
    },
    hydrateUser: (userId) => hydrateUser(adminDb, userId),
    readActiveImpersonation: (actorUserId) => readActiveImpersonation(adminDb, actorUserId),
    newRequestId: () => RequestId(crypto.randomUUID()),
  };
}

// Register policies at the first session read (idempotent). Returns null when
// unauthenticated so the layout gate redirects to sign-in.
export async function getSessionHandler(): Promise<Session | null> {
  registerPolicies();
  return resolveSession(getRequest(), sessionDeps());
}
