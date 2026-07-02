import { isPolicyRegistered, POLICY_BOOTSTRAP_PROBE, registerPolicy } from "@agds-hr/auth";
import {
  canDeactivateUser,
  canGrantRole,
  canStartImpersonation,
  canUpdateProfile,
} from "@agds-hr/identity";
import {
  canAdvanceReview,
  canManageEmployee,
  canOpenReview,
  canRateReview,
  canManageComp,
  canReadDirectory,
  canSignDecision,
  canViewComp,
} from "@agds-hr/people";
import type { ReviewState } from "@agds-hr/people/types";
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
  registerPolicy("people.employee.manage", (user) => canManageEmployee(user));
  registerPolicy("people.review.open", (user) => canOpenReview(user));
  registerPolicy("people.review.advance", (user, resource) =>
    canAdvanceReview(user, resource as { readonly toState: ReviewState }),
  );
  registerPolicy("people.review.rate", (user) => canRateReview(user));
  registerPolicy("people.decision.sign", (user) => canSignDecision(user));
  registerPolicy("people.comp.read", (user) => canViewComp(user));
  registerPolicy("people.comp.manage", (user) => canManageComp(user));
}
