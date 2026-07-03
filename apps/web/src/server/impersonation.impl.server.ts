import { assertCan } from "@agds-hr/auth";
import { getDbAs } from "@agds-hr/db";
import { ensureUserByEmail, startImpersonation, stopImpersonation } from "@agds-hr/identity";
import { isInsideConfigured, listAdminDirectory } from "@agds-hr/inside";
import { ForbiddenError } from "@agds-hr/shared";

import type { ImpersonateStartInput } from "./impersonation.shared.ts";
import { auditContext, requireSession } from "./require-session.server.ts";

// Impersonation (founders + developer): view the product exactly as another
// person sees it. The target is named by email and provisioned on first touch
// (an auth.user row with NO roles — impersonation never grants anything).
// No chaining: an already-impersonating session cannot start another. Start
// and stop are both audited by the DAL; the frame marks the session visibly.
export async function impersonateStartHandler(input: ImpersonateStartInput): Promise<{ ok: true }> {
  const session = await requireSession("people.directory.read");
  if (session.actor.id !== session.subject.id) {
    throw new ForbiddenError("identity.impersonation.start", "already_impersonating");
  }

  const adminDb = getDbAs("admin");
  const email = input.email.toLowerCase();
  let displayName = email.split("@")[0] ?? email;
  if (isInsideConfigured()) {
    const admins = await listAdminDirectory({ limit: 1000 });
    const roster = admins.find((admin) => admin.email.toLowerCase() === email);
    if (roster !== undefined) {
      displayName = `${roster.firstName} ${roster.lastName}`.trim();
    }
  }
  const targetUserId = await ensureUserByEmail(adminDb, email, displayName);

  // The real gate: founder/developer only, never self.
  assertCan(session.subject, "identity.impersonation.start", { targetUserId });

  await startImpersonation(
    adminDb,
    session.actor.id,
    targetUserId,
    input.reason,
    auditContext(session, targetUserId),
  );
  return { ok: true };
}

export async function impersonateStopHandler(): Promise<{ ok: true }> {
  const session = await requireSession("people.directory.read");
  await stopImpersonation(getDbAs("admin"), session.actor.id, auditContext(session));
  return { ok: true };
}
