import { desc, eq, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError } from "@agds-hr/shared";

import { assessment, reviewCase } from "./db/schema.ts";
import {
  canSubmitAssessment,
  isReviewRating,
  type Assessment,
  type AssessmentDimension,
  type EvaluationDimension,
  type ReviewRating,
} from "./types.ts";

// Manager-assessment DAL (design M6): evidence-based — per-dimension score,
// narrative, and evidence. Submission is blocked until every dimension carries
// narrative + evidence and any P6 trigger is acknowledged (canSubmitAssessment,
// pure and unit-tested). Mutations audited.

export type AssessmentDraft = {
  readonly dims: Readonly<Partial<Record<EvaluationDimension, AssessmentDimension>>>;
  readonly narrative: string;
  readonly proposedRating: ReviewRating | undefined;
  readonly promoProposed: boolean;
  readonly promoNote: string;
  readonly compRec: string;
  readonly p6Acknowledged: boolean;
  readonly authorEmail: string;
};

const rowToAssessment = (row: {
  readonly caseId: string;
  readonly dims: unknown;
  readonly narrative: string;
  readonly proposedRating: number | null;
  readonly promoProposed: boolean;
  readonly promoNote: string;
  readonly compRec: string;
  readonly p6Acknowledged: boolean;
  readonly authorEmail: string | null;
  readonly submittedAt: Date | null;
}): Assessment => ({
  caseId: row.caseId,
  dims: (row.dims ?? {}) as Assessment["dims"],
  narrative: row.narrative,
  proposedRating:
    row.proposedRating !== null && isReviewRating(row.proposedRating)
      ? row.proposedRating
      : undefined,
  promoProposed: row.promoProposed,
  promoNote: row.promoNote,
  compRec: row.compRec,
  p6Acknowledged: row.p6Acknowledged,
  authorEmail: row.authorEmail ?? undefined,
  submittedAt: row.submittedAt ?? undefined,
});

const SELECT = {
  caseId: assessment.caseId,
  dims: assessment.dims,
  narrative: assessment.narrative,
  proposedRating: assessment.proposedRating,
  promoProposed: assessment.promoProposed,
  promoNote: assessment.promoNote,
  compRec: assessment.compRec,
  p6Acknowledged: assessment.p6Acknowledged,
  authorEmail: assessment.authorEmail,
  submittedAt: assessment.submittedAt,
};

export async function getAssessmentByCase(
  db: DrizzleExecutor,
  caseId: string,
): Promise<Assessment | undefined> {
  const [row] = await db
    .select(SELECT)
    .from(assessment)
    .where(eq(assessment.caseId, caseId))
    .limit(1);
  return row === undefined ? undefined : rowToAssessment(row);
}

const draftColumns = (draft: AssessmentDraft) => ({
  dims: draft.dims,
  narrative: draft.narrative,
  proposedRating: draft.proposedRating ?? null,
  promoProposed: draft.promoProposed,
  promoNote: draft.promoNote,
  compRec: draft.compRec,
  p6Acknowledged: draft.p6Acknowledged,
  authorEmail: draft.authorEmail.toLowerCase(),
});

export async function saveAssessment(
  db: DrizzleDb,
  caseId: string,
  draft: AssessmentDraft,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ submittedAt: assessment.submittedAt })
      .from(assessment)
      .where(eq(assessment.caseId, caseId))
      .limit(1);
    if (existing?.submittedAt != null) {
      throw new ConflictError("assessment_already_submitted");
    }
    await tx
      .insert(assessment)
      .values({ caseId, ...draftColumns(draft) })
      .onConflictDoUpdate({ target: assessment.caseId, set: draftColumns(draft) });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.assessment.saved",
      resourceId: caseId,
      payload: { dimensions: Object.keys(draft.dims).length },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Submit: the evidence gate + P6 acknowledgment are enforced HERE, not only in
// the UI — a vague assessment cannot enter calibration through any client.
export async function submitAssessment(
  db: DrizzleDb,
  caseId: string,
  draft: AssessmentDraft,
  context: AuditContext,
): Promise<void> {
  if (!canSubmitAssessment(draft)) {
    throw new ConflictError("assessment_incomplete");
  }
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ submittedAt: assessment.submittedAt })
      .from(assessment)
      .where(eq(assessment.caseId, caseId))
      .limit(1);
    if (existing?.submittedAt != null) {
      throw new ConflictError("assessment_already_submitted");
    }
    await tx
      .insert(assessment)
      .values({ caseId, ...draftColumns(draft), submittedAt: sql`now()` })
      .onConflictDoUpdate({
        target: assessment.caseId,
        set: { ...draftColumns(draft), submittedAt: sql`now()` },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.assessment.submitted",
      resourceId: caseId,
      payload: {
        proposedRating: draft.proposedRating ?? null,
        promoProposed: draft.promoProposed,
        p6Acknowledged: draft.p6Acknowledged,
      },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Assessments a person WROTE, newest first, with the case's subject and cycle —
// the record page's "Given reviews · as manager" tab.
export type AuthoredAssessment = Assessment & {
  readonly subjectEmail: string;
  readonly cyclePeriod: string;
};

export async function listAssessmentsByAuthor(
  db: DrizzleExecutor,
  authorEmail: string,
): Promise<readonly AuthoredAssessment[]> {
  const rows = await db
    .select({
      ...SELECT,
      subjectEmail: reviewCase.subjectEmail,
      cyclePeriod: reviewCase.cyclePeriod,
    })
    .from(assessment)
    .innerJoin(reviewCase, eq(reviewCase.id, assessment.caseId))
    .where(eq(assessment.authorEmail, authorEmail.toLowerCase()))
    .orderBy(desc(assessment.updatedAt));
  return rows.map((row) => ({
    ...rowToAssessment(row),
    subjectEmail: row.subjectEmail,
    cyclePeriod: row.cyclePeriod,
  }));
}
