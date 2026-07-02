import { eq, isNull } from "drizzle-orm";

import { user } from "@agds-hr/auth/db/schema";
import type { DrizzleExecutor } from "@agds-hr/db";
import { UserId } from "@agds-hr/shared";

import { employee } from "./db/schema.ts";
import type { DirectoryRow } from "./types.ts";

// Admin-connection only: joins auth.user (name/email — admin-only columns, §6.1),
// so the composition root wires this over getDbAs("admin"). Active employees
// only (soft-delete filter). Rating/band position are review/comp outputs — left
// undefined until those slices land.
export async function listDirectory(db: DrizzleExecutor): Promise<readonly DirectoryRow[]> {
  const rows = await db
    .select({
      userId: employee.userId,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
      level: employee.level,
      path: employee.path,
      country: employee.country,
      roleFamily: employee.roleFamily,
    })
    .from(employee)
    .innerJoin(user, eq(user.id, employee.userId))
    .where(isNull(employee.deletedAt))
    .orderBy(user.email);

  return rows.map((row) => ({
    userId: UserId(row.userId),
    displayName: row.displayName ?? row.name,
    email: row.email,
    level: row.level,
    path: row.path,
    country: row.country,
    roleFamily: row.roleFamily,
    rating: undefined,
    bandPosition: undefined,
  }));
}
