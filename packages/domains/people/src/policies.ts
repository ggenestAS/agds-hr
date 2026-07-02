import type { User } from "@agds-hr/auth";
import { ALLOW, DENY, type PolicyDecision, type UserRole } from "@agds-hr/shared";

import {
  REVIEW_ADVANCE_ROLES,
  REVIEW_AUTHORITY_ROLES,
  REVIEW_RATING_ROLES,
  type ReviewState,
} from "./types.ts";

// Pure predicates, no DB imports (§6.3).
const hasAny = (user: User, roles: readonly UserRole[]): boolean =>
  roles.some((role) => user.roles.includes(role));

// The directory is visible to any authenticated user (the frame is already
// behind the session gate, and it shows no compensation data).
export function canReadDirectory(_user: User): PolicyDecision {
  return ALLOW;
}

// Setting agds-hr attributes (level/path) is an HR-admin edit.
export function canManageEmployee(user: User): PolicyDecision {
  return hasAny(user, ["developer", "admin"]) ? ALLOW : DENY("hr_admin_required");
}

// Who may open a review case or act on the flow at all.
export function canOpenReview(user: User): PolicyDecision {
  return hasAny(user, REVIEW_AUTHORITY_ROLES) ? ALLOW : DENY("review_authority_required");
}

// Who may advance a case INTO a given state (design-mapped, §REVIEW_ADVANCE_ROLES).
export function canAdvanceReview(
  user: User,
  resource: { readonly toState: ReviewState },
): PolicyDecision {
  return hasAny(user, REVIEW_ADVANCE_ROLES[resource.toState])
    ? ALLOW
    : DENY(`role_required_for_${resource.toState}`);
}

// The manager assessment produces the calibrated rating.
export function canRateReview(user: User): PolicyDecision {
  return hasAny(user, REVIEW_RATING_ROLES) ? ALLOW : DENY("rating_role_required");
}

// Only founders (CEO/COO) may sign off a decision; two distinct sign-offs are
// required to deliver (enforced by the DAL, not this predicate).
export function canSignDecision(user: User): PolicyDecision {
  return hasAny(user, ["founder", "developer"]) ? ALLOW : DENY("founder_required");
}

// Compensation is leadership-only. Reading it is itself audited (the DAL records
// the read); admins set the amounts at sign-off (design).
export function canViewComp(user: User): PolicyDecision {
  return hasAny(user, ["admin", "founder", "developer"]) ? ALLOW : DENY("comp_view_required");
}

export function canManageComp(user: User): PolicyDecision {
  return hasAny(user, ["admin", "developer"]) ? ALLOW : DENY("comp_admin_required");
}

// Anyone may appeal their OWN decision within the window; the handler enforces
// ownership + the 30-day clock. Appeals are managed (viewed/resolved) by Admins —
// routed to Admins because a dual-founder sign-off leaves no non-deciding founder.
export function canFileAppeal(_user: User): PolicyDecision {
  return ALLOW;
}

export function canManageAppeals(user: User): PolicyDecision {
  return hasAny(user, ["admin", "developer"]) ? ALLOW : DENY("appeals_admin_required");
}
