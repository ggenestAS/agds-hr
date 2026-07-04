import type { OrgNode } from "@agds-hr/inside";
import type { UserRole } from "@agds-hr/shared";
import { z } from "zod";

// Role management (§9.3 transport shapes). Assignable roles exclude "staff" —
// every authenticated user already has the baseline staff experience with no
// grant (frame.tsx), so granting it would be a no-op that just clutters the
// list. Targets are named by email; most of the roster has no auth.user row
// until first touch, so grant provisions it (ensureUserByEmail) same as
// impersonation does. Kept as its own literal tuple (not derived from
// USER_ROLES) so z.enum sees a proper non-empty literal array.
export const ASSIGNABLE_ROLES = ["developer", "manager", "founder", "admin"] as const;

export const grantRoleSchema = z.object({
  email: z.string().email(),
  role: z.enum(ASSIGNABLE_ROLES),
});
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;

export const revokeRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ASSIGNABLE_ROLES),
});
export type RevokeRoleInput = z.infer<typeof revokeRoleSchema>;

// One row per person who EITHER has a role grant already OR appears in the
// Inside roster (so HR can grant a first role to someone who has never signed
// in). `userId` is undefined for a roster person with no auth.user row yet —
// granting a role from that row provisions it.
export type RoleAssignment = {
  readonly userId: string | undefined;
  readonly email: string;
  readonly name: string;
  readonly title: string | undefined;
  readonly roles: readonly UserRole[];
};

// Inferred from Albert Inside's org tree (both reporting lines): anyone with
// at least one direct report but no product role yet. A candidate, not a
// grant — HR still decides which of these should actually run reviews.
export function directReportCountsByManagerId(
  orgNodes: readonly OrgNode[],
): ReadonlyMap<string, number> {
  const reportsByManager = new Map<string, Set<string>>();
  for (const node of orgNodes) {
    for (const managerUserId of [node.functionalManagerUserId, node.localManagerUserId]) {
      if (managerUserId === undefined) {
        continue;
      }
      const reports = reportsByManager.get(managerUserId) ?? new Set<string>();
      reports.add(node.userId);
      reportsByManager.set(managerUserId, reports);
    }
  }
  return new Map(
    [...reportsByManager.entries()].map(([managerUserId, reports]) => [
      managerUserId,
      reports.size,
    ]),
  );
}

export type OrgManagerSuggestion = {
  readonly email: string;
  readonly name: string;
  readonly title: string | undefined;
  readonly directReports: number;
};

export type RolesPageView = {
  readonly assignments: readonly RoleAssignment[];
  readonly orgManagerSuggestions: readonly OrgManagerSuggestion[];
};
