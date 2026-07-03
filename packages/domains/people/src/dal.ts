import { and, eq, isNull, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";

import { employee } from "./db/schema.ts";
import type {
  CareerLevel,
  CareerPath,
  EmploymentType,
  ReviewParticipationOverride,
} from "./types.ts";

// agds-hr-native attributes attach to a person by verified school email (the
// directory roster comes from Inside). Reads are executor-agnostic; the mutation
// owns its transaction and is audited (§8.1/§8.2).
export type EmployeeAttrs = {
  readonly email: string;
  readonly level: CareerLevel;
  readonly path: CareerPath;
  readonly employmentType: EmploymentType;
  readonly reviewParticipationOverride: ReviewParticipationOverride | null;
};

const ATTRS_SELECT = {
  email: employee.email,
  level: employee.level,
  path: employee.path,
  employmentType: employee.employmentType,
  reviewParticipationOverride: employee.reviewParticipationOverride,
};

export async function listEmployeeAttrs(db: DrizzleExecutor): Promise<readonly EmployeeAttrs[]> {
  return db.select(ATTRS_SELECT).from(employee).where(isNull(employee.deletedAt));
}

export async function getEmployeeByEmail(
  db: DrizzleExecutor,
  email: string,
): Promise<EmployeeAttrs | undefined> {
  const [row] = await db
    .select(ATTRS_SELECT)
    .from(employee)
    .where(and(eq(employee.email, email), isNull(employee.deletedAt)))
    .limit(1);
  return row;
}

export type UpsertEmployeeInput = {
  readonly email: string;
  readonly level: CareerLevel;
  readonly path: CareerPath;
  readonly employmentType: EmploymentType;
  readonly reviewParticipationOverride: ReviewParticipationOverride | null;
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
        employmentType: input.employmentType,
        reviewParticipationOverride: input.reviewParticipationOverride,
        insideUserId: input.insideUserId ?? null,
      })
      .onConflictDoUpdate({
        target: employee.email,
        targetWhere: sql`${employee.deletedAt} is null`,
        set: {
          level: input.level,
          path: input.path,
          employmentType: input.employmentType,
          reviewParticipationOverride: input.reviewParticipationOverride,
          insideUserId: input.insideUserId ?? null,
        },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.employee.attributes_set",
      resourceId: input.email,
      payload: {
        level: input.level,
        path: input.path,
        employmentType: input.employmentType,
        reviewParticipationOverride: input.reviewParticipationOverride,
      },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
