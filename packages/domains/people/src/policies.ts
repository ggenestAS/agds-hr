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

// An individual's compensation (recommendation amounts) is leadership-only.
// Reading it is itself audited (the DAL records the read); admins set the
// amounts at sign-off (design).
export function canViewComp(user: User): PolicyDecision {
  return hasAny(user, ["admin", "founder", "developer"]) ? ALLOW : DENY("comp_view_required");
}

// Compensation *principles* (the merit matrix, what must not drive pay) carry
// no individual or band data — every manager writing an assessment comp
// recommendation needs this guidance, unlike canViewComp (a person's actual
// numbers) or the band figures (still leadership-only to read).
export function canViewCompPrinciples(user: User): PolicyDecision {
  return hasAny(user, ["admin", "founder", "developer", "manager"])
    ? ALLOW
    : DENY("comp_principles_view_required");
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

// Anyone may write their OWN self-review; the handler enforces ownership (the
// case is looked up by the actor's email) and the not-yet-submitted guard.
export function canWriteSelfReview(_user: User): PolicyDecision {
  return ALLOW;
}

// Peer input: creating requests is a reviewer action; responding is open to
// any authenticated user (the handler checks the request is addressed to them).
export function canRequestPeerInput(user: User): PolicyDecision {
  return hasAny(user, ["manager", "founder", "admin", "developer"])
    ? ALLOW
    : DENY("reviewer_required");
}

export function canRespondPeerInput(_user: User): PolicyDecision {
  return ALLOW;
}

// The manager assessment is written by the same set that may rate.
export function canWriteAssessment(user: User): PolicyDecision {
  return hasAny(user, ["manager", "founder", "developer"]) ? ALLOW : DENY("reviewer_required");
}

// Mid-year check-ins (docs/plans/mid-year.md) are a manager filing — managers
// own the day-to-day rhythm, supervised by CEO & COO (handbook). Row scope
// (only your own reports, no self-check-in) is enforced in the handler via the
// manager graph, like /assessment. Filing is January 1–31 only.
export function canWriteCheckIn(user: User): PolicyDecision {
  return hasAny(user, ["manager", "founder", "admin", "developer"])
    ? ALLOW
    : DENY("manager_required");
}

// Band figures are set by the founders (design: bands are built and owned by
// CEO & COO); developer is the usual break-glass.
export function canManageBands(user: User): PolicyDecision {
  return hasAny(user, ["founder", "developer"]) ? ALLOW : DENY("founder_required");
}

// The tracking board ("who still has to do what"): managers see their reports,
// leadership everyone — row scope is enforced in the handler like /assessment;
// this predicate gates the surface (docs/plans/notifications.md).
export function canViewTracking(user: User): PolicyDecision {
  return hasAny(user, ["manager", "founder", "admin", "developer"])
    ? ALLOW
    : DENY("manager_required");
}
