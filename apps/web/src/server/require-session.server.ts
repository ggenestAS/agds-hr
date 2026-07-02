import type { AuditContext } from "@agds-hr/audit";
import { assertCan, type Session } from "@agds-hr/auth";
import { ForbiddenError, type UserId } from "@agds-hr/shared";

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

// Build the audit context from a session (§9.3). subjectUserId defaults to the
// session subject; pass an explicit one for cross-user actions. People edits
// target a person by email (who may have no auth.user id), so they fall back to
// the actor as subject — the resource id on the audit row carries the email.
export function auditContext(session: Session, subjectUserId?: UserId): AuditContext {
  return {
    actorUserId: session.actor.id,
    subjectUserId: subjectUserId ?? session.subject.id,
    requestId: session.requestId,
  };
}
