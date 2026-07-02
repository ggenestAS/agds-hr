import { assertCan, type Session } from "@agds-hr/auth";
import { ForbiddenError } from "@agds-hr/shared";

import { getSessionHandler } from "./session.impl.server.ts";

// Server-fn helper (§9.3): resolve the session (which registers policies via
// getSessionHandler) then assert the action against the subject. Routes through
// the same registration path so no action is ever unregistered at check time.
// Throws ForbiddenError when unauthenticated; the layout gate normally prevents
// reaching here without a session.
export async function requireSession(action: string, resource?: unknown): Promise<Session> {
  const session = await getSessionHandler();
  if (session === null) {
    throw new ForbiddenError(action, "no_session");
  }
  assertCan(session.subject, action, resource);
  return session;
}
