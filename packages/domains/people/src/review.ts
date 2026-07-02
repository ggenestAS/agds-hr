import { and, eq } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError, NotFoundError } from "@agds-hr/shared";

import { reviewCase } from "./db/schema.ts";
import {
  canTransition,
  isReviewRating,
  isReviewState,
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
}): ReviewCase => ({
  id: row.id,
  subjectEmail: row.subjectEmail,
  cyclePeriod: row.cyclePeriod,
  state: row.state,
  rating: row.rating !== null && isReviewRating(row.rating) ? row.rating : undefined,
});

const SELECT = {
  id: reviewCase.id,
  subjectEmail: reviewCase.subjectEmail,
  cyclePeriod: reviewCase.cyclePeriod,
  state: reviewCase.state,
  rating: reviewCase.rating,
};

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
