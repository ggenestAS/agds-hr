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
