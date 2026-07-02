import { desc, eq, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError, NotFoundError, type UserId } from "@agds-hr/shared";

import { appeal } from "./db/schema.ts";
import { isAppealCategory, type Appeal, type AppealCategory } from "./types.ts";

// Appeals live in their own table and are never joined into review/comp/directory
// reads, so they are structurally excluded from future performance views
// (design). Read access is Admins + the appellant only (enforced at the policy /
// handler layer). Mutations are audited.

const SELECT = {
  id: appeal.id,
  caseId: appeal.caseId,
  appellantEmail: appeal.appellantEmail,
  category: appeal.category,
  statement: appeal.statement,
  status: appeal.status,
  resolution: appeal.resolution,
  createdAt: appeal.createdAt,
};

const rowToAppeal = (row: {
  readonly id: string;
  readonly caseId: string;
  readonly appellantEmail: string;
  readonly category: AppealCategory;
  readonly statement: string;
  readonly status: "open" | "resolved";
  readonly resolution: string | null;
  readonly createdAt: Date;
}): Appeal => ({
  id: row.id,
  caseId: row.caseId,
  appellantEmail: row.appellantEmail,
  category: isAppealCategory(row.category) ? row.category : "exception",
  statement: row.statement,
  status: row.status,
  resolution: row.resolution ?? undefined,
  createdAt: row.createdAt,
});

export async function getAppealForCase(
  db: DrizzleExecutor,
  caseId: string,
): Promise<Appeal | undefined> {
  const [row] = await db.select(SELECT).from(appeal).where(eq(appeal.caseId, caseId)).limit(1);
  return row === undefined ? undefined : rowToAppeal(row);
}

export async function listAppeals(db: DrizzleExecutor): Promise<readonly Appeal[]> {
  const rows = await db.select(SELECT).from(appeal).orderBy(desc(appeal.createdAt));
  return rows.map(rowToAppeal);
}

// One appeal per decision (design). The caller enforces the appellant owns the
// decision and the 30-day window is open.
export async function fileAppeal(
  db: DrizzleDb,
  input: {
    readonly caseId: string;
    readonly appellantEmail: string;
    readonly category: AppealCategory;
    readonly statement: string;
  },
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: appeal.id })
      .from(appeal)
      .where(eq(appeal.caseId, input.caseId))
      .limit(1);
    if (existing !== undefined) {
      throw new ConflictError("appeal_already_filed");
    }
    await tx.insert(appeal).values({
      caseId: input.caseId,
      appellantEmail: input.appellantEmail,
      category: input.category,
      statement: input.statement,
    });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.appeal.filed",
      resourceId: input.appellantEmail,
      payload: { category: input.category },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function resolveAppeal(
  db: DrizzleDb,
  appealId: string,
  resolvedBy: UserId,
  resolution: string,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ appellantEmail: appeal.appellantEmail })
      .from(appeal)
      .where(eq(appeal.id, appealId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("appeal", appealId);
    }
    await tx
      .update(appeal)
      .set({ status: "resolved", resolution, resolvedBy, resolvedAt: sql`now()` })
      .where(eq(appeal.id, appealId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.appeal.resolved",
      resourceId: current.appellantEmail,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
