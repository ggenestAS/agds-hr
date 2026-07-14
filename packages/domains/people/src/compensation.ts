import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { ConflictError } from "@agds-hr/shared";

import {
  band,
  campusCoefficient,
  compRecommendation,
  compRecord,
  employee,
  reviewCase,
} from "./db/schema.ts";
import type { Band, CareerLevel, CompRecommendation, CompRecord, ReviewRating } from "./types.ts";
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
// adjusted by campus coefficient with judgment, not mechanically).
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

// Founders maintain the band figures from the Salary bands surface. Upsert by
// [role_family, level]; a degenerate range (min > mid or mid > max) is rejected
// here so no client can write an inverted band. Audited.
export type UpsertBandInput = {
  readonly roleFamily: string;
  readonly level: CareerLevel;
  readonly minEur: number;
  readonly midEur: number;
  readonly maxEur: number;
};

export async function upsertBand(
  db: DrizzleDb,
  input: UpsertBandInput,
  context: AuditContext,
): Promise<void> {
  if (!(input.minEur <= input.midEur && input.midEur <= input.maxEur)) {
    throw new ConflictError("band_range_inverted");
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(band)
      .values({
        roleFamily: input.roleFamily,
        level: input.level,
        minEur: input.minEur,
        midEur: input.midEur,
        maxEur: input.maxEur,
      })
      .onConflictDoUpdate({
        target: [band.roleFamily, band.level],
        set: { minEur: input.minEur, midEur: input.midEur, maxEur: input.maxEur },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.band.updated",
      resourceId: `${input.roleFamily}:${input.level}`,
      payload: { minEur: input.minEur, midEur: input.midEur, maxEur: input.maxEur },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export type CampusCoefficient = {
  readonly campus: string;
  readonly coefficientBp: number;
};

export async function listCampusCoefficients(
  db: DrizzleExecutor,
): Promise<readonly CampusCoefficient[]> {
  return db
    .select({
      campus: campusCoefficient.campus,
      coefficientBp: campusCoefficient.coefficientBp,
    })
    .from(campusCoefficient)
    .orderBy(asc(campusCoefficient.campus));
}

// The full versioned comp history for the employee reconciled by email, newest
// first. ONE audited read for the set — same fail-closed pattern as
// getCompRecommendation (audit row first, same transaction). "Current" is the
// first row with effective_date <= today (currentCompRecord below).
export async function listCompRecords(
  db: DrizzleDb,
  email: string,
  context: AuditContext,
): Promise<readonly CompRecord[]> {
  return db.transaction(async (tx) => {
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.comp.viewed",
      resourceId: email.toLowerCase(),
      payload: { surface: "comp_record_history" },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    return tx
      .select({
        effectiveDate: compRecord.effectiveDate,
        compPeriod: compRecord.compPeriod,
        baseSalaryEur: compRecord.baseSalaryEur,
        variableTargetEur: compRecord.variableTargetEur,
      })
      .from(compRecord)
      .innerJoin(employee, eq(compRecord.employeeId, employee.id))
      .where(and(eq(employee.email, email.toLowerCase()), isNull(employee.deletedAt)))
      .orderBy(desc(compRecord.effectiveDate));
  });
}

// ISO dates compare lexicographically, so text ordering is date ordering.
export function currentCompRecord(
  records: readonly CompRecord[],
  todayIso: string = new Date().toISOString().slice(0, 10),
): CompRecord | undefined {
  return records.find((record) => record.effectiveDate <= todayIso);
}

export type RecordCompensationInput = {
  readonly effectiveDate: string;
  readonly compPeriod: string;
  readonly baseSalaryEur: number;
  readonly variableTargetEur: number;
};

// Compensation changes are new versioned rows, never in-place updates of the
// current package (the upsert keyed on [employee, effective_date] only makes
// re-running a load idempotent). History stays queryable by date.
export async function recordCompensation(
  db: DrizzleDb,
  email: string,
  input: RecordCompensationInput,
  context: AuditContext,
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new ConflictError("effective_date_not_iso");
  }
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: employee.id })
      .from(employee)
      .where(and(eq(employee.email, email.toLowerCase()), isNull(employee.deletedAt)))
      .limit(1);
    if (existing === undefined) {
      throw new ConflictError("employee_not_found");
    }
    await tx
      .insert(compRecord)
      .values({
        employeeId: existing.id,
        effectiveDate: input.effectiveDate,
        compPeriod: input.compPeriod,
        baseSalaryEur: input.baseSalaryEur,
        variableTargetEur: input.variableTargetEur,
      })
      .onConflictDoUpdate({
        target: [compRecord.employeeId, compRecord.effectiveDate],
        set: {
          compPeriod: input.compPeriod,
          baseSalaryEur: input.baseSalaryEur,
          variableTargetEur: input.variableTargetEur,
        },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "people",
      eventType: "people.comp.recorded",
      resourceId: email.toLowerCase(),
      payload: {
        effectiveDate: input.effectiveDate,
        compPeriod: input.compPeriod,
        baseSalaryEur: input.baseSalaryEur,
        variableTargetEur: input.variableTargetEur,
      },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
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
