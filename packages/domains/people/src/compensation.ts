import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";

import { band, compRecommendation, countryCoefficient, reviewCase } from "./db/schema.ts";
import type { Band, CareerLevel, CompRecommendation, ReviewRating } from "./types.ts";
import { isReviewRating } from "./types.ts";

// Band reference lookup — internal config, not a person's comp, so a normal read.
export async function getBand(
  db: DrizzleExecutor,
  roleFamily: string,
  level: CareerLevel,
): Promise<Band | undefined> {
  const [row] = await db
    .select({
      roleFamily: band.roleFamily,
      level: band.level,
      minEur: band.minEur,
      midEur: band.midEur,
      maxEur: band.maxEur,
    })
    .from(band)
    .where(and(eq(band.roleFamily, roleFamily), eq(band.level, level)))
    .limit(1);
  return row === undefined ? undefined : row;
}

// The full band table for the Salary bands surface (France reference figures;
// adjusted by country coefficient with judgment, not mechanically).
export async function listBands(db: DrizzleExecutor): Promise<readonly Band[]> {
  return db
    .select({
      roleFamily: band.roleFamily,
      level: band.level,
      minEur: band.minEur,
      midEur: band.midEur,
      maxEur: band.maxEur,
    })
    .from(band)
    .orderBy(asc(band.roleFamily), asc(band.level));
}

export type CountryCoefficient = {
  readonly country: string;
  readonly coefficientBp: number;
};

export async function listCountryCoefficients(
  db: DrizzleExecutor,
): Promise<readonly CountryCoefficient[]> {
  return db
    .select({
      country: countryCoefficient.country,
      coefficientBp: countryCoefficient.coefficientBp,
    })
    .from(countryCoefficient)
    .orderBy(asc(countryCoefficient.country));
}

// Reading a person's compensation is itself recorded as an audit event — "the
// audit trail is the product" (§10, design). Fail closed: the read runs in a
// transaction that first writes the audit row, so if the audit write fails the
// transaction aborts and NO comp data is returned. Takes an AuditContext, unlike
// every other read in the codebase — that is deliberate.
export async function getCompRecommendation(
  db: DrizzleDb,
  caseId: string,
  context: AuditContext,
): Promise<CompRecommendation | undefined> {
  return db.transaction(async (tx) => {
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.comp.viewed",
      resourceId: caseId,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    const [row] = await tx
      .select({
        currentBaseEur: compRecommendation.currentBaseEur,
        increaseEur: compRecommendation.increaseEur,
        bonusEur: compRecommendation.bonusEur,
        newBaseEur: compRecommendation.newBaseEur,
        effectiveDate: compRecommendation.effectiveDate,
        rationale: compRecommendation.rationale,
      })
      .from(compRecommendation)
      .where(eq(compRecommendation.caseId, caseId))
      .limit(1);
    if (row === undefined) {
      return undefined;
    }
    return {
      currentBaseEur: row.currentBaseEur,
      increaseEur: row.increaseEur,
      bonusEur: row.bonusEur,
      newBaseEur: row.newBaseEur,
      effectiveDate: row.effectiveDate ?? undefined,
      rationale: row.rationale ?? undefined,
    };
  });
}

// The Documentation surface (design): every delivered decision with its comp
// recommendation and rationale. One audited read for the whole page — the
// audit event carries the cycle, in the same transaction as the select
// (fail-closed, like getCompRecommendation).
export type DecisionSummary = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly rating: ReviewRating | undefined;
  readonly decidedAt: Date;
  readonly comp: CompRecommendation | undefined;
};

export async function listDecisionSummaries(
  db: DrizzleDb,
  cyclePeriod: string,
  context: AuditContext,
): Promise<readonly DecisionSummary[]> {
  return db.transaction(async (tx) => {
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.comp.viewed",
      resourceId: `cycle:${cyclePeriod}`,
      payload: { surface: "documentation" },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    const rows = await tx
      .select({
        caseId: reviewCase.id,
        subjectEmail: reviewCase.subjectEmail,
        rating: reviewCase.rating,
        decidedAt: reviewCase.decidedAt,
        currentBaseEur: compRecommendation.currentBaseEur,
        increaseEur: compRecommendation.increaseEur,
        bonusEur: compRecommendation.bonusEur,
        newBaseEur: compRecommendation.newBaseEur,
        effectiveDate: compRecommendation.effectiveDate,
        rationale: compRecommendation.rationale,
      })
      .from(reviewCase)
      .leftJoin(compRecommendation, eq(compRecommendation.caseId, reviewCase.id))
      .where(and(eq(reviewCase.cyclePeriod, cyclePeriod), isNotNull(reviewCase.decidedAt)))
      .orderBy(desc(reviewCase.decidedAt));
    return rows.map((row) => ({
      caseId: row.caseId,
      subjectEmail: row.subjectEmail,
      rating: row.rating !== null && isReviewRating(row.rating) ? row.rating : undefined,
      decidedAt: row.decidedAt!,
      comp:
        row.currentBaseEur === null
          ? undefined
          : {
              currentBaseEur: row.currentBaseEur,
              increaseEur: row.increaseEur!,
              bonusEur: row.bonusEur!,
              newBaseEur: row.newBaseEur!,
              effectiveDate: row.effectiveDate ?? undefined,
              rationale: row.rationale ?? undefined,
            },
    }));
  });
}

export type UpsertCompInput = {
  readonly currentBaseEur: number;
  readonly increaseEur: number;
  readonly bonusEur: number;
  readonly effectiveDate?: string;
  readonly rationale?: string;
};

export async function upsertCompRecommendation(
  db: DrizzleDb,
  caseId: string,
  input: UpsertCompInput,
  context: AuditContext,
): Promise<void> {
  const newBaseEur = input.currentBaseEur + input.increaseEur;
  await db.transaction(async (tx) => {
    await tx
      .insert(compRecommendation)
      .values({
        caseId,
        currentBaseEur: input.currentBaseEur,
        increaseEur: input.increaseEur,
        bonusEur: input.bonusEur,
        newBaseEur,
        effectiveDate: input.effectiveDate ?? null,
        rationale: input.rationale ?? null,
      })
      .onConflictDoUpdate({
        target: compRecommendation.caseId,
        set: {
          currentBaseEur: input.currentBaseEur,
          increaseEur: input.increaseEur,
          bonusEur: input.bonusEur,
          newBaseEur,
          effectiveDate: input.effectiveDate ?? null,
          rationale: input.rationale ?? null,
        },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.comp.recommended",
      resourceId: caseId,
      payload: { increaseEur: input.increaseEur, bonusEur: input.bonusEur, newBaseEur },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
