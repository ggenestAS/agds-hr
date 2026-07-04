import { and, eq, inArray, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError } from "@agds-hr/shared";

import { checkIn } from "./db/schema.ts";
import { checkInSubmitIssues, isCheckInStatus, type CheckIn, type CheckInDraft } from "./types.ts";

// Mid-year check-in DAL (P5, docs/plans/mid-year.md). Draft save + final
// submit, both audited; the submit gate (checkInSubmitIssues, pure) is
// enforced HERE, not only in the UI — an empty filing cannot become the P5
// record through any client. Submit is final, like the assessment.

const SELECT = {
  subjectEmail: checkIn.subjectEmail,
  period: checkIn.period,
  status: checkIn.status,
  summary: checkIn.summary,
  p1Confirmed: checkIn.p1Confirmed,
  p1Note: checkIn.p1Note,
  promoFlag: checkIn.promoFlag,
  promoNote: checkIn.promoNote,
  underperfFlag: checkIn.underperfFlag,
  underperfNote: checkIn.underperfNote,
  authorEmail: checkIn.authorEmail,
  submittedAt: checkIn.submittedAt,
};

const rowToCheckIn = (row: {
  readonly subjectEmail: string;
  readonly period: string;
  readonly status: string | null;
  readonly summary: string;
  readonly p1Confirmed: boolean;
  readonly p1Note: string;
  readonly promoFlag: boolean;
  readonly promoNote: string;
  readonly underperfFlag: boolean;
  readonly underperfNote: string;
  readonly authorEmail: string | null;
  readonly submittedAt: Date | null;
}): CheckIn => ({
  subjectEmail: row.subjectEmail,
  period: row.period,
  status: row.status !== null && isCheckInStatus(row.status) ? row.status : undefined,
  summary: row.summary,
  p1Confirmed: row.p1Confirmed,
  p1Note: row.p1Note,
  promoFlag: row.promoFlag,
  promoNote: row.promoNote,
  underperfFlag: row.underperfFlag,
  underperfNote: row.underperfNote,
  authorEmail: row.authorEmail ?? undefined,
  submittedAt: row.submittedAt ?? undefined,
});

export async function getCheckIn(
  db: DrizzleExecutor,
  subjectEmail: string,
  period: string,
): Promise<CheckIn | undefined> {
  const [row] = await db
    .select(SELECT)
    .from(checkIn)
    .where(and(eq(checkIn.subjectEmail, subjectEmail.toLowerCase()), eq(checkIn.period, period)))
    .limit(1);
  return row === undefined ? undefined : rowToCheckIn(row);
}

export async function listCheckInsForPeriod(
  db: DrizzleExecutor,
  subjectEmails: readonly string[],
  period: string,
): Promise<readonly CheckIn[]> {
  if (subjectEmails.length === 0) {
    return [];
  }
  const rows = await db
    .select(SELECT)
    .from(checkIn)
    .where(
      and(
        inArray(
          checkIn.subjectEmail,
          subjectEmails.map((email) => email.toLowerCase()),
        ),
        eq(checkIn.period, period),
      ),
    );
  return rows.map(rowToCheckIn);
}

const draftColumns = (draft: CheckInDraft, authorEmail: string) => ({
  status: draft.status ?? null,
  summary: draft.summary,
  p1Confirmed: draft.p1Confirmed,
  p1Note: draft.p1Note,
  promoFlag: draft.promoFlag,
  promoNote: draft.promoNote,
  underperfFlag: draft.underperfFlag,
  underperfNote: draft.underperfNote,
  authorEmail: authorEmail.toLowerCase(),
});

async function upsertCheckIn(
  db: DrizzleDb,
  input: {
    readonly subjectEmail: string;
    readonly period: string;
    readonly draft: CheckInDraft;
    readonly authorEmail: string;
    readonly submit: boolean;
  },
  context: AuditContext,
): Promise<void> {
  const subjectEmail = input.subjectEmail.toLowerCase();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ submittedAt: checkIn.submittedAt })
      .from(checkIn)
      .where(and(eq(checkIn.subjectEmail, subjectEmail), eq(checkIn.period, input.period)))
      .limit(1);
    if (existing?.submittedAt != null) {
      throw new ConflictError("check_in_already_submitted");
    }
    const columns = {
      ...draftColumns(input.draft, input.authorEmail),
      ...(input.submit ? { submittedAt: sql`now()` } : {}),
    };
    await tx
      .insert(checkIn)
      .values({ subjectEmail, period: input.period, ...columns })
      .onConflictDoUpdate({
        target: [checkIn.subjectEmail, checkIn.period],
        set: columns,
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: input.submit ? "people.check_in.submitted" : "people.check_in.saved",
      resourceId: `${subjectEmail}:${input.period}`,
      payload: input.submit
        ? {
            status: input.draft.status ?? null,
            promoFlag: input.draft.promoFlag,
            underperfFlag: input.draft.underperfFlag,
            p1Confirmed: input.draft.p1Confirmed,
          }
        : {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function saveCheckIn(
  db: DrizzleDb,
  subjectEmail: string,
  period: string,
  draft: CheckInDraft,
  authorEmail: string,
  context: AuditContext,
): Promise<void> {
  await upsertCheckIn(db, { subjectEmail, period, draft, authorEmail, submit: false }, context);
}

export async function submitCheckIn(
  db: DrizzleDb,
  subjectEmail: string,
  period: string,
  draft: CheckInDraft,
  authorEmail: string,
  context: AuditContext,
): Promise<void> {
  const issues = checkInSubmitIssues(draft);
  if (issues.length > 0) {
    throw new ConflictError(`check_in_incomplete: ${issues.join("; ")}`);
  }
  await upsertCheckIn(db, { subjectEmail, period, draft, authorEmail, submit: true }, context);
}
