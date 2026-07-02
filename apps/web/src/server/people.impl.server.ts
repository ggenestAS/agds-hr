import { getDbAs } from "@agds-hr/db";
import { listDirectory, type DirectoryRow } from "@agds-hr/people";

import { requireSession } from "./require-session.server.ts";

// Gated read: session + policy first (requireSession), then the DAL on the admin
// connection (the directory joins auth.user's admin-only columns, §6.1).
export async function listDirectoryHandler(): Promise<readonly DirectoryRow[]> {
  await requireSession("people.directory.read");
  return listDirectory(getDbAs("admin"));
}
