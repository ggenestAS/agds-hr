import type { HydratedUser, Session, SessionDeps, User } from "./types.ts";

// resolveSession does one logical read of the auth session, then hydrates the
// actor and resolves the subject (docs/new-project-directives.md §6.2). Fail
// closed: a valid cookie does not survive deactivation — a deactivated actor
// resolves to no session, so the next request loses access. The BetterAuth
// read and the hydration are injected (SessionDeps) so this stays unit-testable
// before the web app and test harness exist.

const toUser = (hydrated: HydratedUser): User => ({
  id: hydrated.id,
  email: hydrated.email,
  roles: hydrated.roles,
  relationships: hydrated.relationships,
});

export async function resolveSession(request: Request, deps: SessionDeps): Promise<Session | null> {
  const authSession = await deps.readAuthSession(request);
  if (authSession === null) {
    return null;
  }

  const actor = await deps.hydrateUser(authSession.userId);
  // Missing or deactivated actor -> no session (fail closed).
  if (actor === undefined || actor.deactivatedAt !== null) {
    return null;
  }

  const impersonatedId = await deps.readActiveImpersonation(actor.id);
  // Impersonation resolves the subject; if the impersonated user cannot be
  // hydrated, fall back to acting as oneself rather than failing the request.
  const subject =
    impersonatedId === null ? actor : ((await deps.hydrateUser(impersonatedId)) ?? actor);

  return {
    actor: toUser(actor),
    subject: toUser(subject),
    authSessionId: authSession.authSessionId,
    requestId: deps.newRequestId(),
  };
}
