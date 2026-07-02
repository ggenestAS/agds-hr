import type { User } from "@agds-hr/auth";
import { ALLOW, DENY, type PolicyDecision } from "@agds-hr/shared";

// Pure predicates, no DB imports (§6.3). The directory is visible to any
// authenticated user (the frame is already behind the session gate, and it
// shows no compensation data). Setting agds-hr attributes is a privileged edit;
// gated to developer until the HR admin role lands (charter trigger).
export function canReadDirectory(_user: User): PolicyDecision {
  return ALLOW;
}

export function canManageEmployee(user: User): PolicyDecision {
  return user.roles.includes("developer") ? ALLOW : DENY("developer_required");
}

// Advancing a review case / setting a rating. Gated to developer until the
// stage-specific HR roles (manager, LT member, founder) land (charter trigger);
// the per-stage authorization (who may move which transition) is a later slice.
export function canManageReview(user: User): PolicyDecision {
  return user.roles.includes("developer") ? ALLOW : DENY("developer_required");
}
