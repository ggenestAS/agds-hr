import { getDbAs } from "@agds-hr/db";
import { ensureUserByEmail, grantRole, listUsers, revokeRole } from "@agds-hr/identity";
import { isInsideConfigured, listAdminDirectory, listOrgTree } from "@agds-hr/inside";
import { UserId, type UserRole } from "@agds-hr/shared";

import type {
  GrantRoleInput,
  OrgManagerSuggestion,
  RevokeRoleInput,
  RolesPageView,
} from "./roles.shared.ts";
import { directReportCountsByManagerId } from "./roles.shared.ts";
import { auditContext, requireSession } from "./require-session.server.ts";

type MergedRow = {
  userId: string | undefined;
  name: string;
  title: string | undefined;
  roles: readonly UserRole[];
};

// Role management: who is manager/founder/admin/developer, and how to change
// it. Merges provisioned auth.user role grants with the Inside roster so HR
// can grant a first role to someone who has never signed in — granting
// provisions the auth.user row (ensureUserByEmail), same pattern as
// impersonation. staff is never listed as grantable: every authenticated user
// already has it as the no-grant baseline (frame.tsx).
export async function rolesPageHandler(): Promise<RolesPageView> {
  await requireSession("identity.role.grant");
  const adminDb = getDbAs("admin");
  const [users, admins, orgNodes] = await Promise.all([
    listUsers(adminDb, { limit: 500 }),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
    isInsideConfigured() ? listOrgTree() : Promise.resolve([]),
  ]);

  const byEmail = new Map<string, MergedRow>();

  for (const admin of admins) {
    byEmail.set(admin.email.toLowerCase(), {
      userId: undefined,
      name: `${admin.firstName} ${admin.lastName}`.trim(),
      title: admin.title,
      roles: [],
    });
  }
  for (const user of users) {
    const email = user.email.toLowerCase();
    const existing = byEmail.get(email);
    byEmail.set(email, {
      userId: user.id,
      name: existing?.name ?? user.displayName ?? user.email,
      title: existing?.title,
      roles: user.roles,
    });
  }

  const assignments = [...byEmail.entries()]
    .map(([email, entry]) => ({ email, ...entry }))
    // Surface people with a role first, then the rest alphabetically — the
    // page is a role registry, not a directory browse.
    .sort((left, right) => {
      if (left.roles.length !== right.roles.length) {
        return right.roles.length - left.roles.length;
      }
      return left.name.localeCompare(right.name);
    });

  // Infer candidates from the org tree (both reporting lines — same edges as
  // the manager graph): anyone with at least one direct report is a plausible
  // reviewer, but this is a suggestion, not a grant. A person with reports
  // in Inside but no product role yet is exactly who the review cycle needs
  // `manager` authority for (opening cases, peer input, assessment).
  const directReportCounts = directReportCountsByManagerId(orgNodes);
  const adminByUserId = new Map(admins.map((admin) => [admin.userId, admin]));
  const orgManagerSuggestions: OrgManagerSuggestion[] = [];
  for (const [managerUserId, directReports] of directReportCounts) {
    const admin = adminByUserId.get(managerUserId);
    if (admin === undefined) {
      continue;
    }
    const existing = byEmail.get(admin.email.toLowerCase());
    if (existing !== undefined && existing.roles.length > 0) {
      continue; // already has a product role — not a gap
    }
    orgManagerSuggestions.push({
      email: admin.email.toLowerCase(),
      name: `${admin.firstName} ${admin.lastName}`.trim(),
      title: admin.title,
      directReports,
    });
  }
  orgManagerSuggestions.sort(
    (left, right) =>
      right.directReports - left.directReports || left.name.localeCompare(right.name),
  );

  return { assignments, orgManagerSuggestions };
}

export async function grantRoleHandler(input: GrantRoleInput): Promise<{ ok: true }> {
  const session = await requireSession("identity.role.grant");
  const adminDb = getDbAs("admin");
  const email = input.email.toLowerCase();

  let displayName = email.split("@")[0] ?? email;
  if (isInsideConfigured()) {
    const admins = await listAdminDirectory({ limit: 1000 });
    const roster = admins.find((admin) => admin.email.toLowerCase() === email);
    if (roster !== undefined) {
      displayName = `${roster.firstName} ${roster.lastName}`.trim();
    }
  }
  const targetUserId = await ensureUserByEmail(adminDb, email, displayName);

  await grantRole(adminDb, targetUserId, input.role, auditContext(session, targetUserId));
  return { ok: true };
}

export async function revokeRoleHandler(input: RevokeRoleInput): Promise<{ ok: true }> {
  const session = await requireSession("identity.role.grant");
  await revokeRole(
    getDbAs("admin"),
    UserId(input.userId),
    input.role,
    auditContext(session, UserId(input.userId)),
  );
  return { ok: true };
}
