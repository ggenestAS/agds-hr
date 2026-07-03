import type { User } from "@agds-hr/auth";
import { ALLOW, DENY, type PolicyDecision } from "@agds-hr/shared";

// The audit trail is the product (§10) — and it is leadership-only to READ.
// Writes happen in-transaction from domain DALs; nothing here gates those.
export function canReadAuditLog(user: User): PolicyDecision {
  return user.roles.some((role) => role === "admin" || role === "founder" || role === "developer")
    ? ALLOW
    : DENY("audit_leadership_required");
}
