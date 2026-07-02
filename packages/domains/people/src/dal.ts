import { and, eq, isNull, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";

import { employee } from "./db/schema.ts";
import type { CareerLevel, CareerPath } from "./types.ts";

// agds-hr-native attributes attach to a person by verified school email (the
// directory roster comes from Inside). Reads are executor-agnostic; the mutation
// owns its transaction and is audited (§8.1/§8.2).
export type EmployeeAttrs = {
  readonly email: string;
  readonly level: CareerLevel;
  readonly path: CareerPath;
};

export async function listEmployeeAttrs(db: DrizzleExecutor): Promise<readonly EmployeeAttrs[]> {
  const rows = await db
    .select({ email: employee.email, level: employee.level, path: employee.path })
    .from(employee)
    .where(isNull(employee.deletedAt));
  return rows.map((row) => ({ email: row.email, level: row.level, path: row.path }));
}

export async function getEmployeeByEmail(
  db: DrizzleExecutor,
  email: string,
): Promise<EmployeeAttrs | undefined> {
  const [row] = await db
    .select({ email: employee.email, level: employee.level, path: employee.path })
    .from(employee)
    .where(and(eq(employee.email, email), isNull(employee.deletedAt)))
    .limit(1);
  return row === undefined ? undefined : { email: row.email, level: row.level, path: row.path };
}

export type UpsertEmployeeInput = {
  readonly email: string;
  readonly level: CareerLevel;
  readonly path: CareerPath;
  readonly insideUserId?: string;
};

// Assign/replace an active employee's agds-hr attributes, keyed on the partial
// unique index over active rows. Audited; the target email is the resource
// (the person may have no provisioned auth.user id).
export async function upsertEmployeeByEmail(
  db: DrizzleDb,
  input: UpsertEmployeeInput,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(employee)
      .values({
        email: input.email,
        level: input.level,
        path: input.path,
        insideUserId: input.insideUserId ?? null,
      })
      .onConflictDoUpdate({
        target: employee.email,
        targetWhere: sql`${employee.deletedAt} is null`,
        set: { level: input.level, path: input.path, insideUserId: input.insideUserId ?? null },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.employee.attributes_set",
      resourceId: input.email,
      payload: { level: input.level, path: input.path },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
