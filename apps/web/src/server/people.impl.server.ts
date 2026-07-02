import { can } from "@agds-hr/auth";
import { getDbAs } from "@agds-hr/db";
import {
  isInsideConfigured,
  listAdminDirectory,
  listOrgTree,
  managementChain,
  type InsideAdmin,
} from "@agds-hr/inside";
import {
  advanceCase,
  getCaseBySubject,
  getCompRecommendation,
  getEmployeeByEmail,
  getSignoffs,
  listCasesForCycle,
  listEmployeeAttrs,
  listRatingsForCycle,
  openCase,
  REVIEW_CURRENT_CYCLE,
  REVIEW_TRANSITIONS,
  setCaseRating,
  signDecision,
  upsertCompRecommendation,
  upsertEmployeeByEmail,
} from "@agds-hr/people";
import type { ReviewRating } from "@agds-hr/people/types";
import { NotFoundError } from "@agds-hr/shared";

import type {
  CalibrationSummary,
  CompView,
  DirectoryEntry,
  PersonDetail,
  SetCompInput,
  SetEmployeeAttrsInput,
} from "./people.shared.ts";
import { auditContext, requireSession } from "./require-session.server.ts";

// The directory is the Albert Inside roster merged with agds-hr-native level/path
// (people.employee, by email) and the current-cycle rating; the empty state shows
// when Inside is unconfigured. All reads run on the admin connection.
const toEntry = (admin: InsideAdmin): DirectoryEntry => ({
  userId: admin.userId,
  name: `${admin.firstName} ${admin.lastName}`.trim(),
  email: admin.email,
  title: admin.title,
  campus: admin.campus,
  country: admin.country,
  managerName: admin.functionalManagerName,
  active: admin.active,
  level: undefined,
  path: undefined,
  rating: undefined,
});

export async function listDirectoryHandler(): Promise<readonly DirectoryEntry[]> {
  await requireSession("people.directory.read");
  if (!isInsideConfigured()) {
    return [];
  }
  const adminDb = getDbAs("admin");
  const [admins, attrs, ratings] = await Promise.all([
    listAdminDirectory({ limit: 1000 }),
    listEmployeeAttrs(adminDb),
    listRatingsForCycle(adminDb, REVIEW_CURRENT_CYCLE),
  ]);
  const byEmail = new Map(attrs.map((entry) => [entry.email.toLowerCase(), entry]));
  return admins.map((admin) => {
    const assigned = byEmail.get(admin.email.toLowerCase());
    return {
      ...toEntry(admin),
      level: assigned?.level,
      path: assigned?.path,
      rating: ratings.get(admin.email.toLowerCase()),
    };
  });
}

export async function personDetailHandler(userId: string): Promise<PersonDetail> {
  const session = await requireSession("people.directory.read");
  const adminDb = getDbAs("admin");
  const [admins, orgNodes] = await Promise.all([
    listAdminDirectory({ limit: 1000 }),
    listOrgTree(),
  ]);
  const admin = admins.find((candidate) => candidate.userId === userId);
  if (admin === undefined) {
    throw new NotFoundError("person", userId);
  }

  const [attrs, reviewCase] = await Promise.all([
    getEmployeeByEmail(adminDb, admin.email.toLowerCase()),
    getCaseBySubject(adminDb, admin.email.toLowerCase(), REVIEW_CURRENT_CYCLE),
  ]);

  const managers = managementChain(orgNodes, userId).map((node) => ({
    userId: node.userId,
    name: `${node.firstName} ${node.lastName}`.trim(),
    title: node.title,
  }));

  const signoffs = reviewCase === undefined ? [] : await getSignoffs(adminDb, reviewCase.id);

  return {
    userId: admin.userId,
    name: `${admin.firstName} ${admin.lastName}`.trim(),
    email: admin.email,
    title: admin.title,
    campus: admin.campus,
    country: admin.country,
    active: admin.active,
    level: attrs?.level,
    path: attrs?.path,
    managers,
    reviewCase:
      reviewCase === undefined
        ? undefined
        : {
            id: reviewCase.id,
            state: reviewCase.state,
            rating: reviewCase.rating,
            nextStates: REVIEW_TRANSITIONS[reviewCase.state],
            signoffCount: signoffs.length,
            decidedAt: reviewCase.decidedAt?.toISOString(),
            appealUntil: reviewCase.appealUntil?.toISOString(),
            p6Triggered: reviewCase.p6Triggered,
          },
    canEditAttrs: can(session.subject, "people.employee.manage").allow,
    canReview: can(session.subject, "people.review.open").allow,
    canSign: can(session.subject, "people.decision.sign").allow,
    canViewComp: can(session.subject, "people.comp.read").allow,
    canManageComp: can(session.subject, "people.comp.manage").allow,
  };
}

export async function setEmployeeAttrsHandler(input: SetEmployeeAttrsInput): Promise<{ ok: true }> {
  const session = await requireSession("people.employee.manage");
  await upsertEmployeeByEmail(
    getDbAs("admin"),
    { email: input.email.toLowerCase(), level: input.level, path: input.path },
    auditContext(session),
  );
  return { ok: true };
}

export async function openReviewHandler(input: { readonly email: string }): Promise<{ ok: true }> {
  const session = await requireSession("people.review.open");
  await openCase(
    getDbAs("admin"),
    input.email.toLowerCase(),
    REVIEW_CURRENT_CYCLE,
    auditContext(session),
  );
  return { ok: true };
}

export async function advanceReviewHandler(input: {
  readonly caseId: string;
  readonly toState: Parameters<typeof advanceCase>[2];
}): Promise<{ ok: true }> {
  const session = await requireSession("people.review.advance", { toState: input.toState });
  await advanceCase(getDbAs("admin"), input.caseId, input.toState, auditContext(session));
  return { ok: true };
}

export async function setRatingHandler(input: {
  readonly caseId: string;
  readonly rating: number;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.review.rate");
  await setCaseRating(
    getDbAs("admin"),
    input.caseId,
    input.rating as ReviewRating,
    auditContext(session),
  );
  return { ok: true };
}

export async function signDecisionHandler(input: {
  readonly caseId: string;
}): Promise<{ readonly signoffs: number; readonly delivered: boolean }> {
  const session = await requireSession("people.decision.sign");
  return signDecision(getDbAs("admin"), input.caseId, session.actor.id, auditContext(session));
}

// Reading compensation is itself an audited event (fail-closed in the DAL) — the
// audit trail is the product. Band position / merit suggestion light up once the
// person's role family and bands are configured (both unseeded today).
export async function compHandler(input: { readonly caseId: string }): Promise<CompView> {
  const session = await requireSession("people.comp.read");
  const recommendation = await getCompRecommendation(
    getDbAs("admin"),
    input.caseId,
    auditContext(session),
  );
  return {
    recommendation: recommendation ?? undefined,
    bandPositionPct: undefined,
    meritSuggestionBp: undefined,
  };
}

export async function setCompHandler(input: SetCompInput): Promise<{ ok: true }> {
  const session = await requireSession("people.comp.manage");
  await upsertCompRecommendation(
    getDbAs("admin"),
    input.caseId,
    {
      currentBaseEur: input.currentBaseEur,
      increaseEur: input.increaseEur,
      bonusEur: input.bonusEur,
      ...(input.effectiveDate !== undefined ? { effectiveDate: input.effectiveDate } : {}),
      ...(input.rationale !== undefined ? { rationale: input.rationale } : {}),
    },
    auditContext(session),
  );
  return { ok: true };
}

export async function calibrationHandler(): Promise<CalibrationSummary> {
  await requireSession("people.review.open");
  const cases = await listCasesForCycle(getDbAs("admin"), REVIEW_CURRENT_CYCLE);
  const distribution: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let unrated = 0;
  const needsDecision: { subjectEmail: string; rating: number | undefined }[] = [];
  for (const entry of cases) {
    if (entry.rating === undefined) {
      unrated += 1;
    } else {
      distribution[entry.rating] += 1;
    }
    // Flagged for calibration & sign-off: at calibration/decision, not yet delivered.
    if ((entry.state === "calibration" || entry.state === "decision") && !entry.decided) {
      needsDecision.push({ subjectEmail: entry.subjectEmail, rating: entry.rating });
    }
  }
  return { cycle: REVIEW_CURRENT_CYCLE, distribution, total: cases.length, unrated, needsDecision };
}
