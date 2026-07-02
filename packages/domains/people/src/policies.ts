import type { User } from "@agds-hr/auth";
import { ALLOW, type PolicyDecision } from "@agds-hr/shared";

// Pure predicate, no DB imports (§6.3). The directory is visible to any
// authenticated user — the frame is already behind the session gate, and the
// directory shows no compensation data in slice 1. Comp-data read gating and
// its audit-of-reads requirement arrive with slice 4.
export function canReadDirectory(_user: User): PolicyDecision {
  return ALLOW;
}
