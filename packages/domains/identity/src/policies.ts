import type { User } from "@agds-hr/auth";
import { ALLOW, DENY, type PolicyDecision, type UserId } from "@agds-hr/shared";

// Pure predicates, no DB imports (docs/new-project-directives.md §6.3). The
// composition root (step 6) adapts and registers these; deny reasons are
// snake_case. `user` here is the session subject.
const isDeveloper = (user: User): boolean => user.roles.includes("developer");

export function canUpdateProfile(
  user: User,
  resource: { readonly userId: UserId },
): PolicyDecision {
  if (user.id === resource.userId) {
    return ALLOW;
  }
  return isDeveloper(user) ? ALLOW : DENY("not_owner_or_developer");
}

export function canDeactivateUser(user: User): PolicyDecision {
  return isDeveloper(user) ? ALLOW : DENY("developer_required");
}

export function canGrantRole(user: User): PolicyDecision {
  return isDeveloper(user) ? ALLOW : DENY("developer_required");
}

export function canStartImpersonation(
  user: User,
  resource: { readonly targetUserId: UserId },
): PolicyDecision {
  if (!isDeveloper(user)) {
    return DENY("developer_required");
  }
  if (user.id === resource.targetUserId) {
    return DENY("cannot_impersonate_self");
  }
  return ALLOW;
}
