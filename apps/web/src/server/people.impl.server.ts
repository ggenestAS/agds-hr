import { listEvents } from "@agds-hr/audit";
import { can } from "@agds-hr/auth";
import { getDbAs } from "@agds-hr/db";
import { listUsers } from "@agds-hr/identity";
import {
  isInsideConfigured,
  listAdminDirectory,
  listOrgTree,
  managementChain,
  type InsideAdmin,
} from "@agds-hr/inside";
import {
  advanceCase,
  canFileAppealNow,
  canSeeAppeal,
  createPeerRequests,
  declinePeerRequest,
  fileAppeal,
  getAppealForCase,
  getCaseById,
  listBands,
  listCountryCoefficients,
  getCaseBySubject,
  getCompRecommendation,
  getEmployeeByEmail,
  getSignoffs,
  listAppeals,
  listCasesForCycle,
  listDecisionSummaries,
  listEmployeeAttrs,
  listRatingsForCycle,
  getAssessmentByCase,
  getSelfReviewByCase,
  isPeerQuotaMet,
  listPeerRequestsForCase,
  listPeerRequestsForRequestee,
  openCase,
  reopenSelfReview,
  saveAssessment,
  submitAssessment,
  submitPeerInput,
  resolveAppeal,
  saveSelfReview,
  submitSelfReview,
  REVIEW_CURRENT_CYCLE,
  REVIEW_TRANSITIONS,
  setCaseRating,
  signDecision,
  upsertCompRecommendation,
  upsertEmployeeByEmail,
} from "@agds-hr/people";
import type { AssessmentDraft } from "@agds-hr/people";
import type { AppealCategory, ReviewRating } from "@agds-hr/people/types";
import { ForbiddenError, NotFoundError } from "@agds-hr/shared";

import type {
  AppealView,
  AssessCaseDetail,
  AssessCaseSummary,
  AssessmentSaveInput,
  AuditLogRow,
  BandsView,
  CalibrationSummary,
  CompView,
  DecisionDoc,
  DirectoryEntry,
  OverviewData,
  PeerCaseView,
  PeerPageView,
  PeerRequestCreateInput,
  PeerSubmitInput,
  PersonDetail,
  SelfReviewPayloadInput,
  SelfReviewView,
  SignPageView,
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

  // The appeal (statement/category/resolution) is visible to HR Admins and the
  // appellant only (design) — never to an arbitrary directory viewer. The
  // canAppeal affordance is likewise for the subject alone, within the window.
  // The rules themselves are pure and unit-tested (canSeeAppeal/canFileAppealNow).
  const isSubject = session.actor.email.toLowerCase() === admin.email.toLowerCase();
  const canManageAppeals = can(session.subject, "people.appeal.manage").allow;
  const filedAppeal =
    reviewCase === undefined ? undefined : await getAppealForCase(adminDb, reviewCase.id);
  const appeal = canSeeAppeal({ isSubject, canManageAppeals }) ? filedAppeal : undefined;
  const canAppeal = canFileAppealNow({
    isSubject,
    appealUntilMs: reviewCase?.appealUntil?.getTime(),
    nowMs: Date.now(),
    alreadyFiled: filedAppeal !== undefined,
  });

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
    appeal:
      appeal === undefined
        ? undefined
        : {
            id: appeal.id,
            caseId: appeal.caseId,
            appellantEmail: appeal.appellantEmail,
            category: appeal.category,
            statement: appeal.statement,
            status: appeal.status,
            resolution: appeal.resolution,
            createdAt: appeal.createdAt.toISOString(),
          },
    canAppeal,
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
  const adminDb = getDbAs("admin");
  // The LT peer-input gate (design M5): a case that entered peer_input cannot
  // advance to the manager assessment until 2 LT + 2 own-team inputs are in.
  if (input.toState === "manager_assessment") {
    const reviewCase = await getCaseById(adminDb, input.caseId);
    if (reviewCase?.state === "peer_input") {
      const requests = await listPeerRequestsForCase(adminDb, input.caseId);
      if (!isPeerQuotaMet(requests)) {
        throw new ForbiddenError("people.review.advance", "peer_quota_not_met");
      }
    }
  }
  await advanceCase(adminDb, input.caseId, input.toState, auditContext(session));
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

// Self-review handlers (design: "input, not the rating"). The subject's OWN
// form: the case is looked up by the actor's email, never by a client-supplied
// id, so ownership is structural. Saving/submitting auto-opens the case
// (idempotent) — the self-review is how a cycle starts for most people.
export async function selfReviewGetHandler(): Promise<SelfReviewView> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  const reviewCase = await getCaseBySubject(adminDb, email, REVIEW_CURRENT_CYCLE);
  const selfReview =
    reviewCase === undefined ? undefined : await getSelfReviewByCase(adminDb, reviewCase.id);

  let managerName: string | undefined;
  if (isInsideConfigured()) {
    const [admins, orgNodes] = await Promise.all([
      listAdminDirectory({ limit: 1000 }),
      listOrgTree(),
    ]);
    const me = admins.find((admin) => admin.email.toLowerCase() === email);
    if (me !== undefined) {
      const chain = managementChain(orgNodes, me.userId);
      const first = chain[0];
      managerName = first === undefined ? undefined : `${first.firstName} ${first.lastName}`.trim();
    }
  }

  return {
    caseId: reviewCase?.id,
    payload: (selfReview?.payload ?? {}) as SelfReviewView["payload"],
    submittedAt: selfReview?.submittedAt?.toISOString(),
    managerName,
    locked: reviewCase?.decidedAt !== undefined,
  };
}

async function ensureOwnCase(session: Awaited<ReturnType<typeof requireSession>>) {
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  return openCase(adminDb, email, REVIEW_CURRENT_CYCLE, auditContext(session));
}

const cleanPayload = (payload: SelfReviewPayloadInput["payload"]): Record<string, string> =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Record<
    string,
    string
  >;

export async function selfReviewSaveHandler(input: SelfReviewPayloadInput): Promise<{ ok: true }> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const reviewCase = await ensureOwnCase(session);
  const existing = await getSelfReviewByCase(adminDb, reviewCase.id);
  if (existing?.submittedAt !== undefined) {
    throw new ForbiddenError("people.selfreview.write", "already_submitted");
  }
  await saveSelfReview(adminDb, reviewCase.id, cleanPayload(input.payload), auditContext(session));
  return { ok: true };
}

export async function selfReviewSubmitHandler(
  input: SelfReviewPayloadInput,
): Promise<{ ok: true }> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const reviewCase = await ensureOwnCase(session);
  const existing = await getSelfReviewByCase(adminDb, reviewCase.id);
  if (existing?.submittedAt !== undefined) {
    throw new ForbiddenError("people.selfreview.write", "already_submitted");
  }
  await submitSelfReview(
    adminDb,
    reviewCase.id,
    cleanPayload(input.payload),
    auditContext(session),
  );
  return { ok: true };
}

export async function selfReviewReopenHandler(): Promise<{ ok: true }> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  const reviewCase = await getCaseBySubject(adminDb, email, REVIEW_CURRENT_CYCLE);
  if (reviewCase === undefined) {
    throw new NotFoundError("review case", email);
  }
  if (reviewCase.decidedAt !== undefined) {
    throw new ForbiddenError("people.selfreview.write", "decision_delivered");
  }
  await reopenSelfReview(adminDb, reviewCase.id, auditContext(session));
  return { ok: true };
}

// Peer input handlers (design M5). Named input — never anonymous, never shown
// to the person being reviewed: the reviewer view structurally excludes the
// actor's OWN case, so nobody (including founders) reads peer input about
// themselves through this surface.
export async function peerPageHandler(): Promise<PeerPageView> {
  const session = await requireSession("people.peer.respond");
  const adminDb = getDbAs("admin");
  const actorEmail = session.actor.email.toLowerCase();
  const isReviewer = can(session.subject, "people.peer.request").allow;

  const [forYou, admins] = await Promise.all([
    listPeerRequestsForRequestee(adminDb, actorEmail),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      `${admin.firstName} ${admin.lastName}`.trim(),
    ]),
  );

  let cases: PeerCaseView[] = [];
  if (isReviewer) {
    const allCases = await listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE);
    const inScope = allCases.filter(
      (entry) =>
        !entry.decided &&
        (entry.state === "self_review" || entry.state === "peer_input") &&
        entry.subjectEmail.toLowerCase() !== actorEmail,
    );
    cases = await Promise.all(
      inScope.map(async (entry) => {
        const requests = await listPeerRequestsForCase(adminDb, entry.caseId);
        return {
          caseId: entry.caseId,
          subjectEmail: entry.subjectEmail,
          subjectName: nameByEmail.get(entry.subjectEmail.toLowerCase()),
          state: entry.state,
          quotaMet: isPeerQuotaMet(requests),
          requests: requests.map((request) => ({
            id: request.id,
            requesteeEmail: request.requesteeEmail,
            requesteeName: nameByEmail.get(request.requesteeEmail),
            kind: request.kind,
            status: request.status,
            declineReason: request.declineReason,
            submittedAt: request.submittedAt?.toISOString(),
            input: request.input,
          })),
        };
      }),
    );
  }

  return {
    requestsForYou: forYou.map((request) => ({
      id: request.id,
      subjectEmail: request.subjectEmail,
      subjectName: nameByEmail.get(request.subjectEmail.toLowerCase()),
      kind: request.kind,
      status: request.status,
      declineReason: request.declineReason,
    })),
    isReviewer,
    cases,
    directory: admins
      .filter((admin) => admin.active && admin.email.toLowerCase() !== actorEmail)
      .map((admin) => ({
        email: admin.email.toLowerCase(),
        name: `${admin.firstName} ${admin.lastName}`.trim(),
        title: admin.title,
      })),
  };
}

export async function peerRequestCreateHandler(
  input: PeerRequestCreateInput,
): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.request");
  const adminDb = getDbAs("admin");
  const reviewCase = await getCaseById(adminDb, input.caseId);
  if (reviewCase === undefined) {
    throw new NotFoundError("review case", input.caseId);
  }
  if (reviewCase.subjectEmail.toLowerCase() === session.actor.email.toLowerCase()) {
    throw new ForbiddenError("people.peer.request", "own_review");
  }
  const subjectEmail = reviewCase.subjectEmail.toLowerCase();
  await createPeerRequests(
    adminDb,
    input.caseId,
    session.actor.id,
    input.requests.filter((request) => request.email.toLowerCase() !== subjectEmail),
    auditContext(session),
  );
  return { ok: true };
}

const cleanDims = (
  input: PeerSubmitInput["input"],
): Readonly<Partial<Record<keyof PeerSubmitInput["input"], string>>> =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value.trim().length > 0),
  ) as Readonly<Partial<Record<keyof PeerSubmitInput["input"], string>>>;

export async function peerSubmitHandler(input: PeerSubmitInput): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.respond");
  await submitPeerInput(
    getDbAs("admin"),
    input.requestId,
    session.actor.email,
    cleanDims(input.input),
    auditContext(session),
  );
  return { ok: true };
}

export async function peerDeclineHandler(input: {
  readonly requestId: string;
  readonly reason: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.respond");
  await declinePeerRequest(
    getDbAs("admin"),
    input.requestId,
    session.actor.email,
    input.reason,
    auditContext(session),
  );
  return { ok: true };
}

// Assessment handlers (design M6). The reviewer's own case is excluded — no
// one assesses themselves. Submitting writes the case rating (audited) so the
// proposal lands in calibration.
export async function assessListHandler(): Promise<readonly AssessCaseSummary[]> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  const actorEmail = session.actor.email.toLowerCase();
  const [cases, admins] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      `${admin.firstName} ${admin.lastName}`.trim(),
    ]),
  );
  return cases
    .filter((entry) => !entry.decided && entry.subjectEmail.toLowerCase() !== actorEmail)
    .map((entry) => ({
      caseId: entry.caseId,
      subjectEmail: entry.subjectEmail,
      subjectName: nameByEmail.get(entry.subjectEmail.toLowerCase()),
      state: entry.state,
    }));
}

export async function assessDetailHandler(caseId: string): Promise<AssessCaseDetail> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  const reviewCase = await getCaseById(adminDb, caseId);
  if (reviewCase === undefined) {
    throw new NotFoundError("review case", caseId);
  }
  if (reviewCase.subjectEmail.toLowerCase() === session.actor.email.toLowerCase()) {
    throw new ForbiddenError("people.assessment.write", "own_review");
  }
  const [attrs, selfReview, peerRequests, existing, admins] = await Promise.all([
    getEmployeeByEmail(adminDb, reviewCase.subjectEmail.toLowerCase()),
    getSelfReviewByCase(adminDb, caseId),
    listPeerRequestsForCase(adminDb, caseId),
    getAssessmentByCase(adminDb, caseId),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const roster = admins.find(
    (admin) => admin.email.toLowerCase() === reviewCase.subjectEmail.toLowerCase(),
  );
  return {
    caseId,
    subjectEmail: reviewCase.subjectEmail,
    subjectName: roster === undefined ? undefined : `${roster.firstName} ${roster.lastName}`.trim(),
    state: reviewCase.state,
    level: attrs?.level,
    path: attrs?.path,
    selfReview: (selfReview?.payload ?? {}) as AssessCaseDetail["selfReview"],
    selfReviewSubmittedAt: selfReview?.submittedAt?.toISOString(),
    peerSubmitted: peerRequests.filter((request) => request.status === "submitted").length,
    peerDeclined: peerRequests.filter((request) => request.status === "declined").length,
    priorRating: reviewCase.rating,
    assessment:
      existing === undefined
        ? undefined
        : {
            dims: existing.dims,
            narrative: existing.narrative,
            proposedRating: existing.proposedRating,
            promoProposed: existing.promoProposed,
            compRec: existing.compRec,
            p6Acknowledged: existing.p6Acknowledged,
            submittedAt: existing.submittedAt?.toISOString(),
          },
  };
}

const toDraft = (input: AssessmentSaveInput): AssessmentDraft => ({
  dims: Object.fromEntries(
    Object.entries(input.dims).filter(([, value]) => value !== undefined),
  ) as AssessmentDraft["dims"],
  narrative: input.narrative,
  proposedRating:
    input.proposedRating === undefined ? undefined : (input.proposedRating as ReviewRating),
  promoProposed: input.promoProposed,
  compRec: input.compRec,
  p6Acknowledged: input.p6Acknowledged,
});

export async function assessSaveHandler(input: AssessmentSaveInput): Promise<{ ok: true }> {
  const session = await requireSession("people.assessment.write");
  await saveAssessment(getDbAs("admin"), input.caseId, toDraft(input), auditContext(session));
  return { ok: true };
}

export async function assessSubmitHandler(input: AssessmentSaveInput): Promise<{ ok: true }> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  await submitAssessment(adminDb, input.caseId, toDraft(input), auditContext(session));
  if (input.proposedRating !== undefined) {
    await setCaseRating(
      adminDb,
      input.caseId,
      input.proposedRating as ReviewRating,
      auditContext(session),
    );
  }
  return { ok: true };
}

// Decision & sign-off (design M8). The queue is every case at calibration or
// later; each entry carries its sign-off emails, the assessment's proposal
// (rating, comp TYPE, rationale), and the delivery/appeal markers. Comp
// AMOUNTS stay behind the audited compFn read — the queue never leaks them.
export async function signQueueHandler(): Promise<SignPageView> {
  const session = await requireSession("people.review.open");
  const adminDb = getDbAs("admin");
  const [cases, admins, users] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
    listUsers(adminDb),
  ]);
  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      `${admin.firstName} ${admin.lastName}`.trim(),
    ]),
  );
  const emailById = new Map(users.map((entry) => [entry.id, entry.email]));

  const inScope = cases.filter(
    (entry) =>
      entry.state === "calibration" ||
      entry.state === "decision" ||
      entry.state === "appeal" ||
      entry.state === "closed" ||
      entry.decided,
  );

  const queue = await Promise.all(
    inScope.map(async (entry) => {
      const [reviewCase, signoffs, attrs, assessment] = await Promise.all([
        getCaseById(adminDb, entry.caseId),
        getSignoffs(adminDb, entry.caseId),
        getEmployeeByEmail(adminDb, entry.subjectEmail.toLowerCase()),
        getAssessmentByCase(adminDb, entry.caseId),
      ]);
      return {
        caseId: entry.caseId,
        subjectEmail: entry.subjectEmail,
        subjectName: nameByEmail.get(entry.subjectEmail.toLowerCase()),
        level: attrs?.level,
        path: attrs?.path,
        state: entry.state,
        rating: entry.rating,
        signoffs: signoffs.map(
          (signoff) => emailById.get(signoff.founderUserId) ?? signoff.founderUserId,
        ),
        signedByMe: signoffs.some((signoff) => signoff.founderUserId === session.actor.id),
        decidedAt: reviewCase?.decidedAt?.toISOString(),
        appealUntil: reviewCase?.appealUntil?.toISOString(),
        p6Triggered: reviewCase?.p6Triggered ?? false,
        compRecType: assessment?.compRec ?? "",
        promoProposed: assessment?.promoProposed ?? false,
        rationale: assessment?.narrative ?? "",
      };
    }),
  );

  return {
    canSign: can(session.subject, "people.decision.sign").allow,
    canViewComp: can(session.subject, "people.comp.read").allow,
    queue,
  };
}

// The Audit log surface (P9): the append-only trail, newest first, with actor
// and subject resolved to emails. Leadership-read-only via audit.log.read;
// reading the log is a governance read, not a comp read, so it is not itself
// audited (the design's P9 queries would drown in their own echoes).
export async function auditLogHandler(): Promise<readonly AuditLogRow[]> {
  await requireSession("audit.log.read");
  const adminDb = getDbAs("admin");
  const [events, users] = await Promise.all([
    listEvents(adminDb, { limit: 200 }),
    listUsers(adminDb),
  ]);
  const emailById = new Map(users.map((entry) => [entry.id, entry.email]));
  return events.map((event) => ({
    id: event.id,
    when: event.createdAt.toISOString(),
    actor: emailById.get(event.actorUserId) ?? event.actorUserId,
    subject: emailById.get(event.subjectUserId) ?? event.subjectUserId,
    eventType: event.eventType,
    resourceId: event.resourceId ?? undefined,
    category: event.eventType.endsWith(".viewed")
      ? "Read"
      : event.eventType.includes("decision") || event.eventType.includes("signoff")
        ? "Sign-off"
        : "Write",
  }));
}

// The Documentation surface: every delivered decision with its documented
// amounts and rationale. The whole read is one audited comp read (fail-closed
// in the DAL). Undocumented decisions surface loudly rather than being hidden.
export async function decisionsHandler(): Promise<readonly DecisionDoc[]> {
  const session = await requireSession("people.comp.read");
  const adminDb = getDbAs("admin");
  const [summaries, admins] = await Promise.all([
    listDecisionSummaries(adminDb, REVIEW_CURRENT_CYCLE, auditContext(session)),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const byEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      { userId: admin.userId, name: `${admin.firstName} ${admin.lastName}`.trim() },
    ]),
  );
  return summaries.map((summary) => {
    const roster = byEmail.get(summary.subjectEmail.toLowerCase());
    const comp = summary.comp;
    const increasePct =
      comp !== undefined && comp.currentBaseEur > 0
        ? Math.round((comp.increaseEur / comp.currentBaseEur) * 100)
        : 0;
    const tag: DecisionDoc["tag"] =
      comp === undefined
        ? "Undocumented"
        : comp.bonusEur > 0
          ? "Bonus"
          : increasePct >= 10
            ? "Promotion-scale raise"
            : comp.increaseEur > 0
              ? "Merit"
              : "No raise";
    const amount =
      comp === undefined
        ? "—"
        : comp.increaseEur === 0 && comp.bonusEur === 0
          ? "No change"
          : [
              comp.increaseEur > 0 ? `+${increasePct}%` : undefined,
              comp.bonusEur > 0 ? `€${comp.bonusEur.toLocaleString("en-US")} bonus` : undefined,
            ]
              .filter(Boolean)
              .join(" + ");
    return {
      caseId: summary.caseId,
      subjectEmail: summary.subjectEmail,
      name: roster?.name,
      userId: roster?.userId,
      rating: summary.rating,
      decidedAt: summary.decidedAt.toISOString(),
      tag,
      amount,
      rationale: comp?.rationale,
      effectiveDate: comp?.effectiveDate,
    };
  });
}

// Salary bands + country coefficients (design: "Internal — used by CEO, COO &
// leadership"). Band figures are reference config, not a person's comp, so a
// normal (leadership-gated) read rather than an audited one.
export async function bandsHandler(): Promise<BandsView> {
  await requireSession("people.comp.read");
  const adminDb = getDbAs("admin");
  const [bands, coefficients] = await Promise.all([
    listBands(adminDb),
    listCountryCoefficients(adminDb),
  ]);
  return { bands, coefficients };
}

// The Overview surface (design): reviewers get stat tiles, the calibrated
// rating distribution, and the needs-a-decision list; everyone gets their own
// case status. One handler behind the directory-read gate, with the reviewer
// extras keyed off the review-open policy.
export async function overviewHandler(): Promise<OverviewData> {
  const session = await requireSession("people.directory.read");
  const adminDb = getDbAs("admin");
  const isReviewer = can(session.subject, "people.review.open").allow;

  const [cases, admins, myCase] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
    getCaseBySubject(adminDb, session.actor.email.toLowerCase(), REVIEW_CURRENT_CYCLE),
  ]);

  const distribution: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let delivered = 0;
  const needsDecision: OverviewData["needsDecision"][number][] = [];
  const byEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      { userId: admin.userId, name: `${admin.firstName} ${admin.lastName}`.trim() },
    ]),
  );
  for (const entry of cases) {
    if (entry.rating !== undefined) {
      distribution[entry.rating] += 1;
    }
    if (entry.decided) {
      delivered += 1;
    }
    if ((entry.state === "calibration" || entry.state === "decision") && !entry.decided) {
      const roster = byEmail.get(entry.subjectEmail.toLowerCase());
      needsDecision.push({
        subjectEmail: entry.subjectEmail,
        name: roster?.name,
        userId: roster?.userId,
        rating: entry.rating,
      });
    }
  }

  const openAppeals = isReviewer
    ? (await listAppeals(adminDb)).filter((appeal) => appeal.status === "open").length
    : 0;

  return {
    cycle: REVIEW_CURRENT_CYCLE,
    isReviewer,
    stats: isReviewer
      ? [
          { label: "People in scope", value: String(admins.length), sub: "Albert Inside roster" },
          {
            label: "Review cases",
            value: `${cases.length}/${admins.length || cases.length}`,
            sub: `${cases.length - delivered} in progress`,
          },
          {
            label: "Decisions delivered",
            value: String(delivered),
            sub: "dual founder sign-off",
          },
          { label: "Open appeals", value: String(openAppeals), sub: "30-day window" },
        ]
      : [],
    distribution,
    needsDecision,
    myCase:
      myCase === undefined
        ? undefined
        : {
            state: myCase.state,
            decidedAt: myCase.decidedAt?.toISOString(),
            appealUntil: myCase.appealUntil?.toISOString(),
          },
  };
}

// Appeals: the appellant may appeal their OWN delivered decision within the
// 30-day window (both enforced here, since the policy only gates the action);
// Admins view and resolve. Appeals live off to the side and are never joined
// into review/comp reads.
export async function fileAppealHandler(input: {
  readonly caseId: string;
  readonly category: AppealCategory;
  readonly statement: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.appeal.file");
  const adminDb = getDbAs("admin");
  const reviewCase = await getCaseById(adminDb, input.caseId);
  if (reviewCase === undefined) {
    throw new NotFoundError("review case", input.caseId);
  }
  if (session.actor.email.toLowerCase() !== reviewCase.subjectEmail.toLowerCase()) {
    throw new ForbiddenError("people.appeal.file", "appeal_owner_only");
  }
  if (reviewCase.decidedAt === undefined || reviewCase.appealUntil === undefined) {
    throw new ForbiddenError("people.appeal.file", "appeal_before_decision");
  }
  if (reviewCase.appealUntil.getTime() < Date.now()) {
    throw new ForbiddenError("people.appeal.file", "appeal_window_closed");
  }
  await fileAppeal(
    adminDb,
    {
      caseId: input.caseId,
      appellantEmail: reviewCase.subjectEmail.toLowerCase(),
      category: input.category,
      statement: input.statement,
    },
    auditContext(session),
  );
  return { ok: true };
}

const toAppealView = (row: {
  readonly id: string;
  readonly caseId: string;
  readonly appellantEmail: string;
  readonly category: AppealCategory;
  readonly statement: string;
  readonly status: "open" | "resolved";
  readonly resolution: string | undefined;
  readonly createdAt: Date;
}): AppealView => ({
  id: row.id,
  caseId: row.caseId,
  appellantEmail: row.appellantEmail,
  category: row.category,
  statement: row.statement,
  status: row.status,
  resolution: row.resolution,
  createdAt: row.createdAt.toISOString(),
});

export async function appealsListHandler(): Promise<readonly AppealView[]> {
  await requireSession("people.appeal.manage");
  const appeals = await listAppeals(getDbAs("admin"));
  return appeals.map(toAppealView);
}

export async function resolveAppealHandler(input: {
  readonly appealId: string;
  readonly resolution: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.appeal.manage");
  await resolveAppeal(
    getDbAs("admin"),
    input.appealId,
    session.actor.id,
    input.resolution,
    auditContext(session),
  );
  return { ok: true };
}
