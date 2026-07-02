import { getDbAs } from "@agds-hr/db";
import { isInsideConfigured, listAdminDirectory, type InsideAdmin } from "@agds-hr/inside";
import { listEmployeeAttrs, listRatingsForCycle, REVIEW_CURRENT_CYCLE } from "@agds-hr/people";

import type { DirectoryEntry } from "./people.shared.ts";
import { requireSession } from "./require-session.server.ts";

// Gated read: session + policy first (requireSession), then the roster. The
// directory is the Albert Inside roster merged with agds-hr-native level/path
// (people.employee, keyed by email) when assigned; the empty state shows when
// Inside is unconfigured.
const toEntry = (admin: InsideAdmin): DirectoryEntry => ({
  userId: admin.userId,
  name: `${admin.firstName} ${admin.lastName}`.trim(),
  email: admin.email,
  title: admin.title,
  campus: admin.campus,
  country: admin.country,
  managerName: admin.functionalManagerName,
  active: admin.active,
  level: undefined,
  path: undefined,
  rating: undefined,
});

export async function listDirectoryHandler(): Promise<readonly DirectoryEntry[]> {
  await requireSession("people.directory.read");
  if (!isInsideConfigured()) {
    return [];
  }
  const adminDb = getDbAs("admin");
  const [admins, attrs, ratings] = await Promise.all([
    listAdminDirectory({ limit: 1000 }),
    listEmployeeAttrs(adminDb),
    listRatingsForCycle(adminDb, REVIEW_CURRENT_CYCLE),
  ]);
  const byEmail = new Map(attrs.map((entry) => [entry.email.toLowerCase(), entry]));
  return admins.map((admin) => {
    const assigned = byEmail.get(admin.email.toLowerCase());
    return {
      ...toEntry(admin),
      level: assigned?.level,
      path: assigned?.path,
      rating: ratings.get(admin.email.toLowerCase()),
    };
  });
}
