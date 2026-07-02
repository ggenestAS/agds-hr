import { isPolicyRegistered, POLICY_BOOTSTRAP_PROBE, registerPolicy } from "@agds-hr/auth";
import {
  canDeactivateUser,
  canGrantRole,
  canStartImpersonation,
  canUpdateProfile,
} from "@agds-hr/identity";
import { canReadDirectory } from "@agds-hr/people";
import { ALLOW, type UserId } from "@agds-hr/shared";

// The composition root (docs/new-project-directives.md §6.3): imports each
// domain's pure predicates and registers them once at boot. Idempotent against
// dev HMR via the bootstrap probe — a second call is a no-op rather than a
// double-registration throw. The typed-resource predicates are adapted here to
// the registry's (user, resource?: unknown) handler shape; the server-fn layer
// passes the matching resource.
export function registerPolicies(): void {
  if (isPolicyRegistered(POLICY_BOOTSTRAP_PROBE)) {
    return;
  }
  registerPolicy(POLICY_BOOTSTRAP_PROBE, () => ALLOW);

  registerPolicy("identity.profile.update", (user, resource) =>
    canUpdateProfile(user, resource as { readonly userId: UserId }),
  );
  registerPolicy("identity.user.deactivate", (user) => canDeactivateUser(user));
  registerPolicy("identity.role.grant", (user) => canGrantRole(user));
  registerPolicy("identity.impersonation.start", (user, resource) =>
    canStartImpersonation(user, resource as { readonly targetUserId: UserId }),
  );

  registerPolicy("people.directory.read", (user) => canReadDirectory(user));
}
