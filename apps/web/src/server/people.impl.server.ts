import { isInsideConfigured, listAdminDirectory, type InsideAdmin } from "@agds-hr/inside";

import type { DirectoryEntry } from "./people.shared.ts";
import { requireSession } from "./require-session.server.ts";

// Gated read: session + policy first (requireSession), then the roster. The
// directory is sourced from the Albert Inside API when configured (the real
// admin/officer roster); otherwise an empty state. agds-hr level/path/rating
// (people.employee) reconcile onto this roster in a later slice.
const toEntry = (admin: InsideAdmin): DirectoryEntry => ({
  userId: admin.userId,
  name: `${admin.firstName} ${admin.lastName}`.trim(),
  email: admin.email,
  title: admin.title,
  campus: admin.campus,
  country: admin.country,
  managerName: admin.functionalManagerName,
  active: admin.active,
});

export async function listDirectoryHandler(): Promise<readonly DirectoryEntry[]> {
  await requireSession("people.directory.read");
  if (!isInsideConfigured()) {
    return [];
  }
  const admins = await listAdminDirectory({ limit: 1000 });
  return admins.map(toEntry);
}
