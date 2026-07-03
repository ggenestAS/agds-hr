import { and, count, desc, eq, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError, NotFoundError, UserId } from "@agds-hr/shared";

import { getEmployeeByEmail } from "./dal.ts";
import { reviewCase, reviewSignoff } from "./db/schema.ts";
import {
  APPEAL_WINDOW_DAYS,
  canTransition,
  isDecisionComplete,
  isP6Triggered,
  isReviewRating,
  isReviewState,
  participatesInReview,
  type ReviewCase,
  type ReviewRating,
  type ReviewState,
} from "./types.ts";

// Review-case DAL. Reads are executor-agnostic; mutations own their transaction
// and are audited (§8.1/§8.2). Transitions are validated against the state
// machine (canTransition) — an illegal move throws rather than corrupting state.

const rowToCase = (row: {
  readonly id: string;
  readonly subjectEmail: string;
  readonly cyclePeriod: string;
  readonly state: ReviewState;
  readonly rating: number | null;
  readonly decidedAt: Date | null;
  readonly appealUntil: Date | null;
  readonly p6Triggered: boolean;
}): ReviewCase => ({
  id: row.id,
  subjectEmail: row.subjectEmail,
  cyclePeriod: row.cyclePeriod,
  state: row.state,
  rating: row.rating !== null && isReviewRating(row.rating) ? row.rating : undefined,
  decidedAt: row.decidedAt ?? undefined,
  appealUntil: row.appealUntil ?? undefined,
  p6Triggered: row.p6Triggered,
});

const SELECT = {
  id: reviewCase.id,
  subjectEmail: reviewCase.subjectEmail,
  cyclePeriod: reviewCase.cyclePeriod,
  state: reviewCase.state,
  rating: reviewCase.rating,
  decidedAt: reviewCase.decidedAt,
  appealUntil: reviewCase.appealUntil,
  p6Triggered: reviewCase.p6Triggered,
};

export async function getCaseById(
  db: DrizzleExecutor,
  caseId: string,
): Promise<ReviewCase | undefined> {
  const [row] = await db.select(SELECT).from(reviewCase).where(eq(reviewCase.id, caseId)).limit(1);
  return row === undefined ? undefined : rowToCase(row);
}

export async function getCaseBySubject(
  db: DrizzleExecutor,
  subjectEmail: string,
  cyclePeriod: string,
): Promise<ReviewCase | undefined> {
  const [row] = await db
    .select(SELECT)
    .from(reviewCase)
    .where(and(eq(reviewCase.subjectEmail, subjectEmail), eq(reviewCase.cyclePeriod, cyclePeriod)))
    .limit(1);
  return row === undefined ? undefined : rowToCase(row);
}

// Every cycle's case for one person, newest cycle first — the record page's
// per-cycle grouping ("Received reviews").
export async function listCasesBySubject(
  db: DrizzleExecutor,
  subjectEmail: string,
): Promise<readonly ReviewCase[]> {
  const rows = await db
    .select(SELECT)
    .from(reviewCase)
    .where(eq(reviewCase.subjectEmail, subjectEmail))
    .orderBy(desc(reviewCase.cyclePeriod));
  return rows.map(rowToCase);
}

// Map of subjectEmail -> rating for a cycle, for the directory Rating column.
export async function listRatingsForCycle(
  db: DrizzleExecutor,
  cyclePeriod: string,
): Promise<ReadonlyMap<string, ReviewRating>> {
  const rows = await db
    .select({ subjectEmail: reviewCase.subjectEmail, rating: reviewCase.rating })
    .from(reviewCase)
    .where(eq(reviewCase.cyclePeriod, cyclePeriod));
  const map = new Map<string, ReviewRating>();
  for (const row of rows) {
    if (row.rating !== null && isReviewRating(row.rating)) {
      map.set(row.subjectEmail.toLowerCase(), row.rating);
    }
  }
  return map;
}

// Open (or return the existing) case for a person in a cycle. Idempotent.
// Participation is gated HERE, in the DAL, so every entry point (the reviewer's
// open button, the subject's self-review auto-open) hits the same mechanism
// (ADR 2026-07-03-employment-types-and-review-participation). A person with no
// employee record reads as the default `employee` type — participating — so
// the gate only bites once HR has marked someone as an exception.
export async function openCase(
  db: DrizzleDb,
  subjectEmail: string,
  cyclePeriod: string,
  context: AuditContext,
): Promise<ReviewCase> {
  return db.transaction(async (tx) => {
    const existing = await getCaseBySubject(tx, subjectEmail, cyclePeriod);
    if (existing !== undefined) {
      return existing;
    }
    const attrs = await getEmployeeByEmail(tx, subjectEmail);
    if (
      attrs !== undefined &&
      !participatesInReview(attrs.employmentType, attrs.reviewParticipationOverride)
    ) {
      throw new ConflictError(`not_in_review_cycle: ${subjectEmail} (${attrs.employmentType})`);
    }
    const [row] = await tx
      .insert(reviewCase)
      .values({ subjectEmail, cyclePeriod })
      .returning(SELECT);
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.review.opened",
      resourceId: subjectEmail,
      payload: { cyclePeriod },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    return rowToCase(row!);
  });
}

// Advance a case to the next state, validated against the state machine.
export async function advanceCase(
  db: DrizzleDb,
  caseId: string,
  toState: ReviewState,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select(SELECT)
      .from(reviewCase)
      .where(eq(reviewCase.id, caseId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("review_case", caseId);
    }
    if (!isReviewState(current.state) || !canTransition(current.state, toState)) {
      throw new ConflictError(`invalid_review_transition: ${current.state} -> ${toState}`);
    }
    await tx.update(reviewCase).set({ state: toState }).where(eq(reviewCase.id, caseId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.review.advanced",
      resourceId: current.subjectEmail,
      payload: { from: current.state, to: toState },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

// Set the calibrated rating (typically at the manager-assessment stage).
export async function setCaseRating(
  db: DrizzleDb,
  caseId: string,
  rating: ReviewRating,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ subjectEmail: reviewCase.subjectEmail, rating: reviewCase.rating })
      .from(reviewCase)
      .where(eq(reviewCase.id, caseId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("review_case", caseId);
    }
    await tx.update(reviewCase).set({ rating }).where(eq(reviewCase.id, caseId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.review.rated",
      resourceId: current.subjectEmail,
      payload: { rating: { before: current.rating, after: rating } },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export type SignDecisionResult = { readonly signoffs: number; readonly delivered: boolean };

// Record a founder's sign-off on a decision, then — only when two DISTINCT
// founders have signed — deliver the decision: stamp decided_at, start the
// 30-day appeal clock, and auto-trigger P6 for ratings of 1–2. A guarded
// accumulation, so a single founder can never deliver.
export async function signDecision(
  db: DrizzleDb,
  caseId: string,
  founderUserId: UserId,
  context: AuditContext,
): Promise<SignDecisionResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(SELECT)
      .from(reviewCase)
      .where(eq(reviewCase.id, caseId))
      .limit(1);
    if (current === undefined) {
      throw new NotFoundError("review_case", caseId);
    }
    if (current.state !== "decision") {
      throw new ConflictError(`decision_not_open: case is in ${current.state}`);
    }

    await tx.insert(reviewSignoff).values({ caseId, founderUserId }).onConflictDoNothing();
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.review.signed",
      resourceId: current.subjectEmail,
      payload: { founderUserId },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });

    const [tally] = await tx
      .select({ value: count() })
      .from(reviewSignoff)
      .where(eq(reviewSignoff.caseId, caseId));
    const signoffs = tally?.value ?? 0;

    let delivered = false;
    if (current.decidedAt === null && isDecisionComplete(signoffs)) {
      const rating =
        current.rating !== null && isReviewRating(current.rating) ? current.rating : undefined;
      const p6 = isP6Triggered(rating);
      await tx
        .update(reviewCase)
        .set({
          decidedAt: sql`now()`,
          appealUntil: sql`now() + make_interval(days => ${APPEAL_WINDOW_DAYS})`,
          p6Triggered: p6,
        })
        .where(eq(reviewCase.id, caseId));
      await recordEvent(tx, {
        actorUserId: context.actorUserId,
        subjectUserId: context.subjectUserId,
        domain: "people",
        eventType: "people.review.decision_delivered",
        resourceId: current.subjectEmail,
        payload: { rating: rating ?? null, p6Triggered: p6, appealWindowDays: APPEAL_WINDOW_DAYS },
        requestId: context.requestId,
        ...(context.ip ? { ip: context.ip } : {}),
      });
      delivered = true;
    }
    return { signoffs, delivered };
  });
}

export async function getSignoffs(
  db: DrizzleExecutor,
  caseId: string,
): Promise<readonly { readonly founderUserId: UserId; readonly signedAt: Date }[]> {
  const rows = await db
    .select({ founderUserId: reviewSignoff.founderUserId, signedAt: reviewSignoff.signedAt })
    .from(reviewSignoff)
    .where(eq(reviewSignoff.caseId, caseId));
  return rows.map((row) => ({ founderUserId: UserId(row.founderUserId), signedAt: row.signedAt }));
}

export type CalibrationCase = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly state: ReviewState;
  readonly rating: ReviewRating | undefined;
  readonly decided: boolean;
};

// The calibration surface: every case in a cycle with its state, rating, and
// whether the decision has been delivered.
export async function listCasesForCycle(
  db: DrizzleExecutor,
  cyclePeriod: string,
): Promise<readonly CalibrationCase[]> {
  const rows = await db
    .select({
      caseId: reviewCase.id,
      subjectEmail: reviewCase.subjectEmail,
      state: reviewCase.state,
      rating: reviewCase.rating,
      decidedAt: reviewCase.decidedAt,
    })
    .from(reviewCase)
    .where(eq(reviewCase.cyclePeriod, cyclePeriod));
  return rows.map((row) => ({
    caseId: row.caseId,
    subjectEmail: row.subjectEmail,
    state: row.state,
    rating: row.rating !== null && isReviewRating(row.rating) ? row.rating : undefined,
    decided: row.decidedAt !== null,
  }));
}
