import { listEvents } from "@agds-hr/audit";
import { can } from "@agds-hr/auth";
import { getDbAs } from "@agds-hr/db";
import {
  canStartImpersonation,
  listReportingEdges,
  listUsers,
  managedUserIds,
} from "@agds-hr/identity";
import {
  isInsideConfigured,
  listAdminDirectory,
  listOrgTree,
  localTeamPeerCount,
  managementChain,
  type InsideAdmin,
  type OrgNode,
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
  listCampusCoefficients,
  getCaseBySubject,
  getCompRecommendation,
  getEmployeeByEmail,
  getSignoffs,
  listAppeals,
  listAssessmentsByAuthor,
  listCasesBySubject,
  listCasesForCycle,
  listDecisionSummaries,
  listEmployeeAttrs,
  getAssessmentByCase,
  getPeerRequestById,
  getSelfReviewByCase,
  listSelfReviewsByCases,
  approvePeerRequest,
  isPeerQuotaMet,
  proposePeerRequests,
  rejectPeerRequest,
  reopenPeerRequest,
  listPeerRequestsForCase,
  listPeerRequestsForCases,
  listPeerRequestsForRequestee,
  openCase,
  peerInputQuota,
  participatesInReview,
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
  upsertBand,
  upsertCompRecommendation,
  upsertEmployeeByEmail,
} from "@agds-hr/people";
import type { AssessmentDraft } from "@agds-hr/people";
import { CAREER_LEVELS } from "@agds-hr/people/types";
import type { AppealCategory, ReviewRating } from "@agds-hr/people/types";
import { REVIEW_CYCLE_PERIOD_LABEL } from "@agds-hr/people/types";
import { ConflictError, ForbiddenError, NotFoundError, UserId } from "@agds-hr/shared";

import {
  formatSelfReviewRole,
  selfReviewSubmitIssues,
  stampSelfReviewHeader,
} from "./people.shared.ts";
import type { SelfReviewContext } from "./people.shared.ts";
import type {
  AppealsPageView,
  AppealView,
  AssessCaseDetail,
  AssessReportRow,
  AssessmentSaveInput,
  AuditLogRow,
  BandsView,
  CalibrationPerson,
  CalibrationSummary,
  CompView,
  DecisionDoc,
  DirectoryEntry,
  GivenAsManagerView,
  GivenAsPeerView,
  MyPeerCaseView,
  OverviewData,
  PeerCaseView,
  PeerPageView,
  PeerProposeInput,
  PeerRequestCreateInput,
  PeerSubmitInput,
  PeerAnswerView,
  PersonDetail,
  ReceivedCycleView,
  SelfReviewPayloadInput,
  SelfReviewView,
  SetBandInput,
  SignPageView,
  SetCompInput,
  SetEmployeeAttrsInput,
} from "./people.shared.ts";
import { auditContext, requireSession } from "./require-session.server.ts";

function resolvePeerInputQuota(
  subjectEmail: string,
  orgNodes: readonly OrgNode[],
  userIdByEmail: ReadonlyMap<string, string>,
): ReturnType<typeof peerInputQuota> {
  const userId = userIdByEmail.get(subjectEmail.toLowerCase());
  // Fail closed when org data is missing — assume a full local team.
  const localPeers =
    userId === undefined || orgNodes.length === 0 ? 2 : localTeamPeerCount(orgNodes, userId);
  return peerInputQuota(localPeers);
}

// The local-team neighborhood of a person: colleagues sharing their local
// manager, their own local reports, and the local manager themself. Drives
// Own-team vs Cross-team auto-classification in the peer pickers.
function localTeamEmails(
  subjectEmail: string,
  orgNodes: readonly OrgNode[],
  userIdByEmail: ReadonlyMap<string, string>,
  emailByUserId: ReadonlyMap<string, string>,
): readonly string[] {
  const userId = userIdByEmail.get(subjectEmail.toLowerCase());
  if (userId === undefined) {
    return [];
  }
  const self = orgNodes.find((node) => node.userId === userId);
  const team = new Set<string>();
  for (const node of orgNodes) {
    const sameManager =
      self?.localManagerUserId !== undefined && node.localManagerUserId === self.localManagerUserId;
    const isMyReport = node.localManagerUserId === userId;
    const isMyManager =
      self?.localManagerUserId !== undefined && node.userId === self.localManagerUserId;
    if (node.userId !== userId && (sameManager || isMyReport || isMyManager)) {
      const email = emailByUserId.get(node.userId);
      if (email !== undefined) {
        team.add(email);
      }
    }
  }
  return [...team];
}

// The directory is the Albert Inside roster merged with agds-hr-native level/path
// (people.employee, by email); the empty state shows when Inside is unconfigured.
// Ratings are deliberately absent — the directory is all-staff-visible while
// ratings are manager-graph-scoped (see personDetailHandler). All reads run on
// the admin connection.
const toEntry = (admin: InsideAdmin): DirectoryEntry => ({
  userId: admin.userId,
  name: `${admin.firstName} ${admin.lastName}`.trim(),
  email: admin.email,
  title: admin.title,
  campus: admin.campus,
  country: admin.country,
  functionalManagerName: admin.functionalManagerName,
  localManagerName: admin.localManagerName,
  active: admin.active,
  level: undefined,
  path: undefined,
  employmentType: undefined,
});

export async function listDirectoryHandler(): Promise<readonly DirectoryEntry[]> {
  await requireSession("people.directory.read");
  if (!isInsideConfigured()) {
    return [];
  }
  const adminDb = getDbAs("admin");
  const [admins, attrs] = await Promise.all([
    listAdminDirectory({ limit: 1000 }),
    listEmployeeAttrs(adminDb),
  ]);
  const byEmail = new Map(attrs.map((entry) => [entry.email.toLowerCase(), entry]));
  return admins.map((admin) => {
    const assigned = byEmail.get(admin.email.toLowerCase());
    return {
      ...toEntry(admin),
      level: assigned?.level,
      path: assigned?.path,
      employmentType: assigned?.employmentType,
    };
  });
}

// The viewer's managed set (improve-ux plan): everyone reachable through
// EITHER reporting line, any depth — as lowercase emails, since people-domain
// records key by email. Small org, so loading all edges + users is cheap.
async function managedEmailSets(
  adminDb: ReturnType<typeof getDbAs>,
  viewerUserId: UserId,
): Promise<{ readonly direct: ReadonlySet<string>; readonly all: ReadonlySet<string> }> {
  const [edges, users] = await Promise.all([
    listReportingEdges(adminDb),
    listUsers(adminDb, { limit: 500 }),
  ]);
  const sets = managedUserIds(edges, viewerUserId);
  const emailById = new Map(users.map((entry) => [entry.id as string, entry.email.toLowerCase()]));
  const toEmails = (ids: ReadonlySet<UserId>): ReadonlySet<string> =>
    new Set(
      [...ids]
        .map((id) => emailById.get(id as string))
        .filter((email): email is string => email !== undefined),
    );
  return { direct: toEmails(sets.direct), all: toEmails(sets.all) };
}

const LEADERSHIP_ROLES = ["founder", "admin", "developer"] as const;
const isLeadership = (roles: readonly string[]): boolean =>
  LEADERSHIP_ROLES.some((role) => roles.includes(role));

const resolvePeerApproverKind = (
  subject: Awaited<ReturnType<typeof requireSession>>["subject"],
): "manager" | "co_founder" => {
  const { reportsTo, localReportsTo } = subject.relationships;
  return reportsTo.length > 0 || localReportsTo.length > 0 ? "manager" : "co_founder";
};

const toAssessmentView = (
  row: NonNullable<Awaited<ReturnType<typeof getAssessmentByCase>>>,
): NonNullable<PersonDetail["received"][number]["assessment"]> => ({
  dims: row.dims,
  narrative: row.narrative,
  proposedRating: row.proposedRating,
  promoProposed: row.promoProposed,
  compRec: row.compRec,
  p6Acknowledged: row.p6Acknowledged,
  submittedAt: row.submittedAt?.toISOString(),
});

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
  const subjectEmail = admin.email.toLowerCase();
  const nameByEmail = new Map(
    admins.map((entry) => [
      entry.email.toLowerCase(),
      { name: `${entry.firstName} ${entry.lastName}`.trim(), userId: entry.userId },
    ]),
  );

  const [attrs, reviewCase, managed] = await Promise.all([
    getEmployeeByEmail(adminDb, subjectEmail),
    getCaseBySubject(adminDb, subjectEmail, REVIEW_CURRENT_CYCLE),
    managedEmailSets(adminDb, session.subject.id),
  ]);

  // Both reporting lines: the functional chain (existing) + direct local manager.
  const managers = managementChain(orgNodes, userId).map((node) => ({
    userId: node.userId,
    name: `${node.firstName} ${node.lastName}`.trim(),
    title: node.title,
  }));
  const localManagerNode = (() => {
    const localManagerId = orgNodes.find((node) => node.userId === userId)?.localManagerUserId;
    if (localManagerId === undefined) {
      return undefined;
    }
    return orgNodes.find((node) => node.userId === localManagerId);
  })();
  const localManager =
    localManagerNode === undefined
      ? undefined
      : {
          userId: localManagerNode.userId,
          name: `${localManagerNode.firstName} ${localManagerNode.lastName}`.trim(),
          title: localManagerNode.title,
        };

  const signoffs = reviewCase === undefined ? [] : await getSignoffs(adminDb, reviewCase.id);

  // Visibility (improve-ux plan): the manager graph, not roles, decides who
  // sees a person's reviews. The subject sees their own self-review AND the
  // manager assessment of themselves — never peer input. Anyone who manages
  // the subject (either line, any depth) and leadership see everything.
  const viewerEmail = session.subject.email.toLowerCase();
  const isSubjectPerson = viewerEmail === subjectEmail;
  const leadership = isLeadership(session.subject.roles);
  const managesSubject = leadership || managed.all.has(subjectEmail);
  const canSeeSelfAndAssessment = managesSubject || isSubjectPerson;

  // Received reviews, one block per cycle.
  const allCases = await listCasesBySubject(adminDb, subjectEmail);
  const received: ReceivedCycleView[] = canSeeSelfAndAssessment
    ? await Promise.all(
        allCases.map(async (entry) => {
          const [selfRow, peerRows, assessmentRow] = await Promise.all([
            getSelfReviewByCase(adminDb, entry.id),
            managesSubject ? listPeerRequestsForCase(adminDb, entry.id) : Promise.resolve([]),
            getAssessmentByCase(adminDb, entry.id),
          ]);
          return {
            cycle: entry.cyclePeriod,
            state: entry.state,
            // Managers (either line, any depth) and leadership see the rating
            // as soon as it exists; the subject only once the decision is
            // delivered — outcomes are communicated after calibration and
            // sign-off, never mid-flight.
            rating: managesSubject || entry.decidedAt !== undefined ? entry.rating : undefined,
            decidedAt: entry.decidedAt?.toISOString(),
            self:
              selfRow === undefined
                ? undefined
                : {
                    payload: selfRow.payload as NonNullable<ReceivedCycleView["self"]>["payload"],
                    submittedAt: selfRow.submittedAt?.toISOString(),
                  },
            peers: managesSubject
              ? peerRows
                  .filter((request) => request.status === "submitted")
                  .map((request) => ({
                    requesteeEmail: request.requesteeEmail,
                    requesteeName: nameByEmail.get(request.requesteeEmail)?.name,
                    kind: request.kind,
                    submittedAt: request.submittedAt?.toISOString(),
                    input: request.input,
                  }))
              : undefined,
            assessment: assessmentRow === undefined ? undefined : toAssessmentView(assessmentRow),
          };
        }),
      )
    : [];

  // Given reviews: what this person wrote. Content is per-item gated — the
  // viewer must be the author, manage that item's subject, or be leadership,
  // and must never be that item's subject.
  const [authoredAssessments, givenPeerRequests] = await Promise.all([
    listAssessmentsByAuthor(adminDb, subjectEmail),
    listPeerRequestsForRequestee(adminDb, subjectEmail),
  ]);
  const givenContentVisible = (itemSubjectEmail: string): boolean => {
    if (viewerEmail === itemSubjectEmail) {
      return false;
    }
    return isSubjectPerson || leadership || managed.all.has(itemSubjectEmail);
  };
  const givenAsManager: GivenAsManagerView[] = authoredAssessments
    .filter((entry) => givenContentVisible(entry.subjectEmail.toLowerCase()))
    .map((entry) => ({
      cycle: entry.cyclePeriod,
      subjectEmail: entry.subjectEmail,
      subjectName: nameByEmail.get(entry.subjectEmail.toLowerCase())?.name,
      subjectUserId: nameByEmail.get(entry.subjectEmail.toLowerCase())?.userId,
      submittedAt: entry.submittedAt?.toISOString(),
      proposedRating: entry.proposedRating,
      narrative: entry.narrative === "" ? undefined : entry.narrative,
    }));
  const givenAsPeer: GivenAsPeerView[] = givenPeerRequests
    .filter((request) => request.status === "submitted" || request.status === "pending")
    .filter((request) => givenContentVisible(request.subjectEmail.toLowerCase()))
    .map((request) => ({
      cycle: REVIEW_CURRENT_CYCLE,
      subjectEmail: request.subjectEmail,
      subjectName: nameByEmail.get(request.subjectEmail.toLowerCase())?.name,
      subjectUserId: nameByEmail.get(request.subjectEmail.toLowerCase())?.userId,
      kind: request.kind,
      status: request.status,
      submittedAt: request.submittedAt?.toISOString(),
      input: request.status === "submitted" ? request.input : undefined,
    }));

  // The appeal (statement/category/resolution) is visible to HR Admins and the
  // appellant only (design) — never to an arbitrary directory viewer.
  const canManageAppeals = can(session.subject, "people.appeal.manage").allow;
  const filedAppeal =
    reviewCase === undefined ? undefined : await getAppealForCase(adminDb, reviewCase.id);
  const appeal = canSeeAppeal({ isSubject: isSubjectPerson, canManageAppeals })
    ? filedAppeal
    : undefined;
  const canAppeal = canFileAppealNow({
    isSubject: isSubjectPerson,
    appealUntilMs: reviewCase?.appealUntil?.getTime(),
    nowMs: Date.now(),
    alreadyFiled: filedAppeal !== undefined,
  });

  // Absent employee record = the default `employee` type (participating,
  // band-governed) — the gate only bites once HR marks an exception.
  const employmentType = attrs?.employmentType ?? "employee";
  const reviewParticipationOverride = attrs?.reviewParticipationOverride ?? null;

  // "View as" affordance: founders/developer, never on your own record, never
  // while already impersonating (no chaining). Display-only — the start
  // handler re-asserts the policy against the target's real auth id.
  const canImpersonate =
    !isSubjectPerson &&
    session.actor.id === session.subject.id &&
    canStartImpersonation(session.subject, {
      targetUserId: UserId("00000000-0000-4000-8000-00000000ffff"),
    }).allow;

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
    employmentType,
    reviewParticipationOverride,
    inReviewCycle: participatesInReview(employmentType, reviewParticipationOverride),
    managers,
    localManager,
    reviewCase:
      reviewCase === undefined
        ? undefined
        : {
            id: reviewCase.id,
            state: reviewCase.state,
            // Rating is manager-graph-scoped: managers/leadership always; the
            // subject once delivered; other directory viewers never.
            rating:
              managesSubject || (isSubjectPerson && reviewCase.decidedAt !== undefined)
                ? reviewCase.rating
                : undefined,
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
    canImpersonate,
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
    isSubject: isSubjectPerson,
    managesSubject,
    received,
    givenAsManager,
    givenAsPeer,
  };
}

export async function setEmployeeAttrsHandler(input: SetEmployeeAttrsInput): Promise<{ ok: true }> {
  const session = await requireSession("people.employee.manage");
  await upsertEmployeeByEmail(
    getDbAs("admin"),
    {
      email: input.email.toLowerCase(),
      level: input.level,
      path: input.path,
      employmentType: input.employmentType,
      reviewParticipationOverride: input.reviewParticipationOverride,
    },
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
  // The peer-input gate (design M5): a case in peer_input cannot advance to the
  // manager assessment until cross-team + own-team quotas are met.
  if (input.toState === "manager_assessment") {
    const reviewCase = await getCaseById(adminDb, input.caseId);
    if (reviewCase?.state === "peer_input") {
      const [requests, orgNodes, admins] = await Promise.all([
        listPeerRequestsForCase(adminDb, input.caseId),
        isInsideConfigured() ? listOrgTree() : Promise.resolve([]),
        isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
      ]);
      const userIdByEmail = new Map(
        admins.map((admin) => [admin.email.toLowerCase(), admin.userId]),
      );
      const quota = resolvePeerInputQuota(reviewCase.subjectEmail, orgNodes, userIdByEmail);
      if (!isPeerQuotaMet(requests, quota)) {
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
  const adminDb = getDbAs("admin");
  const [cases, attrs, admins] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    listEmployeeAttrs(adminDb),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const levelByEmail = new Map(attrs.map((entry) => [entry.email.toLowerCase(), entry.level]));
  const rosterByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      {
        userId: admin.userId,
        name: `${admin.firstName} ${admin.lastName}`.trim(),
        title: admin.title,
      },
    ]),
  );

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

  // Compare people at the same level (design): L4 first, unassigned last.
  const groups = [...CAREER_LEVELS].reverse().map((levelKey) => ({
    level: levelKey as CalibrationSummary["groups"][number]["level"],
    people: [] as CalibrationPerson[],
  }));
  groups.push({ level: undefined, people: [] });
  for (const entry of cases) {
    const email = entry.subjectEmail.toLowerCase();
    const roster = rosterByEmail.get(email);
    const person: CalibrationPerson = {
      subjectEmail: entry.subjectEmail,
      name: roster?.name,
      userId: roster?.userId,
      title: roster?.title,
      state: entry.state,
      rating: entry.rating,
    };
    const level = levelByEmail.get(email);
    (groups.find((group) => group.level === level) ?? groups[groups.length - 1]!).people.push(
      person,
    );
  }

  return {
    cycle: REVIEW_CURRENT_CYCLE,
    distribution,
    total: cases.length,
    unrated,
    needsDecision,
    groups: groups.filter((group) => group.people.length > 0),
  };
}

// Self-review handlers (design: "input, not the rating"). The subject's OWN
// form: the case is looked up by the actor's email, never by a client-supplied
// id, so ownership is structural. Saving/submitting auto-opens the case
// (idempotent) — the self-review is how a cycle starts for most people.
async function resolveSelfReviewContext(
  session: Awaited<ReturnType<typeof requireSession>>,
  adminDb: ReturnType<typeof getDbAs>,
): Promise<SelfReviewContext> {
  const email = session.actor.email.toLowerCase();
  const attrs = await getEmployeeByEmail(adminDb, email);

  let name = session.actor.email;
  let title: string | undefined;
  let manager = "—";

  if (isInsideConfigured()) {
    const [admins, orgNodes] = await Promise.all([
      listAdminDirectory({ limit: 1000 }),
      listOrgTree(),
    ]);
    const me = admins.find((admin) => admin.email.toLowerCase() === email);
    if (me !== undefined) {
      name = `${me.firstName} ${me.lastName}`.trim();
      title = me.title;
      const chain = managementChain(orgNodes, me.userId);
      const first = chain[0];
      manager = first === undefined ? "—" : `${first.firstName} ${first.lastName}`.trim();
    }
  }

  return {
    name,
    role: formatSelfReviewRole({ title, level: attrs?.level, path: attrs?.path }),
    manager,
    period: REVIEW_CYCLE_PERIOD_LABEL,
  };
}

export async function selfReviewGetHandler(): Promise<SelfReviewView> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  const [reviewCase, context] = await Promise.all([
    getCaseBySubject(adminDb, email, REVIEW_CURRENT_CYCLE),
    resolveSelfReviewContext(session, adminDb),
  ]);
  const selfReview =
    reviewCase === undefined ? undefined : await getSelfReviewByCase(adminDb, reviewCase.id);

  return {
    caseId: reviewCase?.id,
    payload: (selfReview?.payload ?? {}) as SelfReviewView["payload"],
    submittedAt: selfReview?.submittedAt?.toISOString(),
    context,
    locked: reviewCase?.decidedAt !== undefined,
  };
}

async function ensureOwnCase(session: Awaited<ReturnType<typeof requireSession>>) {
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  return openCase(adminDb, email, REVIEW_CURRENT_CYCLE, auditContext(session));
}

export async function selfReviewSaveHandler(input: SelfReviewPayloadInput): Promise<{ ok: true }> {
  const session = await requireSession("people.selfreview.write");
  const adminDb = getDbAs("admin");
  const reviewCase = await ensureOwnCase(session);
  const existing = await getSelfReviewByCase(adminDb, reviewCase.id);
  if (existing?.submittedAt !== undefined) {
    throw new ForbiddenError("people.selfreview.write", "already_submitted");
  }
  const context = await resolveSelfReviewContext(session, adminDb);
  await saveSelfReview(
    adminDb,
    reviewCase.id,
    stampSelfReviewHeader(input.payload, context),
    auditContext(session),
  );
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
  // The submit gate re-runs server-side (fail closed): min complete objectives,
  // no half-filled rows, word bounds on filled fields — same pure helper the
  // form uses to disable the button.
  const issues = selfReviewSubmitIssues(input.payload);
  if (issues.length > 0) {
    throw new ConflictError(`self_review_requirements_not_met (${issues.join("; ")})`);
  }
  const context = await resolveSelfReviewContext(session, adminDb);
  await submitSelfReview(
    adminDb,
    reviewCase.id,
    stampSelfReviewHeader(input.payload, context),
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
// Inside roster/org calls are best-effort on this page: a slow or unreachable
// Inside API must not leave the route loader pending forever (Workers fetch
// has no default timeout — see @agds-hr/inside client).
async function loadInsideDirectory(): Promise<readonly InsideAdmin[]> {
  if (!isInsideConfigured()) {
    return [];
  }
  try {
    return await listAdminDirectory({ limit: 1000 });
  } catch {
    return [];
  }
}

async function loadInsideOrgTree(): Promise<readonly OrgNode[]> {
  if (!isInsideConfigured()) {
    return [];
  }
  try {
    return await listOrgTree();
  } catch {
    return [];
  }
}

export async function peerPageHandler(): Promise<PeerPageView> {
  const session = await requireSession("people.peer.respond");
  const adminDb = getDbAs("admin");
  // Peer requests are addressed to the effective user (subject), not the signed-in
  // actor — otherwise impersonation shows an empty "Requests for you" list.
  const effectiveEmail = session.subject.email.toLowerCase();
  const isReviewer = can(session.subject, "people.peer.request").allow;
  const leadership = isLeadership(session.subject.roles);

  const [forYou, admins, orgNodes, managed, myAttrs, myReviewCase] = await Promise.all([
    listPeerRequestsForRequestee(adminDb, effectiveEmail),
    loadInsideDirectory(),
    loadInsideOrgTree(),
    managedEmailSets(adminDb, session.subject.id),
    getEmployeeByEmail(adminDb, effectiveEmail),
    getCaseBySubject(adminDb, effectiveEmail, REVIEW_CURRENT_CYCLE),
  ]);
  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      `${admin.firstName} ${admin.lastName}`.trim(),
    ]),
  );
  const titleByEmail = new Map(admins.map((admin) => [admin.email.toLowerCase(), admin.title]));
  const userIdByEmail = new Map(admins.map((admin) => [admin.email.toLowerCase(), admin.userId]));
  const emailByUserId = new Map(admins.map((admin) => [admin.userId, admin.email.toLowerCase()]));

  // The viewer's OWN case: status only, never content. The propose form yields
  // once the manager has set (or approved) live requests.
  const myEmploymentType = myAttrs?.employmentType ?? "employee";
  const inReviewCycle = participatesInReview(
    myEmploymentType,
    myAttrs?.reviewParticipationOverride ?? null,
  );
  const myRequests =
    myReviewCase === undefined ? [] : await listPeerRequestsForCase(adminDb, myReviewCase.id);
  const hasManagerSet = myRequests.some((request) => request.status !== "proposed");
  const pendingProposals = myRequests.filter((request) => request.status === "proposed").length;
  const approverKind = resolvePeerApproverKind(session.subject);
  const myCaseOpenForPeers =
    myReviewCase === undefined ||
    (myReviewCase.decidedAt === undefined &&
      (myReviewCase.state === "self_review" || myReviewCase.state === "peer_input"));
  const myCase: MyPeerCaseView = {
    caseId: myReviewCase?.id,
    inReviewCycle,
    canPropose: inReviewCycle && myCaseOpenForPeers && !hasManagerSet,
    hasManagerSet,
    approverKind,
    pendingProposals,
    requests: myRequests.map((request) => ({
      requesteeEmail: request.requesteeEmail,
      requesteeName: nameByEmail.get(request.requesteeEmail),
      kind: request.kind,
      status: request.status,
    })),
    teamEmails: localTeamEmails(effectiveEmail, orgNodes, userIdByEmail, emailByUserId),
  };

  let cases: PeerCaseView[] = [];
  if (isReviewer) {
    const allCases = await listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE);
    // Manager-graph scoping (improve-ux plan): a manager works their own
    // reports' cases; leadership sees every case (never their own).
    const inScope = allCases.filter(
      (entry) =>
        !entry.decided &&
        (entry.state === "self_review" || entry.state === "peer_input") &&
        entry.subjectEmail.toLowerCase() !== effectiveEmail &&
        (leadership || managed.all.has(entry.subjectEmail.toLowerCase())),
    );
    const caseIds = inScope.map((entry) => entry.caseId);
    const [allRequests, allSelfReviews] = await Promise.all([
      listPeerRequestsForCases(adminDb, caseIds),
      listSelfReviewsByCases(adminDb, caseIds),
    ]);
    const requestsByCase = new Map<string, (typeof allRequests)[number][]>();
    for (const request of allRequests) {
      const bucket = requestsByCase.get(request.caseId);
      if (bucket === undefined) {
        requestsByCase.set(request.caseId, [request]);
      } else {
        bucket.push(request);
      }
    }
    const selfReviewByCase = new Map(allSelfReviews.map((entry) => [entry.caseId, entry]));

    cases = inScope.map((entry) => {
      const requests = requestsByCase.get(entry.caseId) ?? [];
      const selfReview = selfReviewByCase.get(entry.caseId);
      const peerSuggestions = (selfReview?.payload["sr_peers"] ?? "").trim();
      const quota = resolvePeerInputQuota(entry.subjectEmail, orgNodes, userIdByEmail);
      return {
        caseId: entry.caseId,
        subjectEmail: entry.subjectEmail,
        subjectName: nameByEmail.get(entry.subjectEmail.toLowerCase()),
        state: entry.state,
        quota,
        quotaMet: isPeerQuotaMet(requests, quota),
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
        peerSuggestions: peerSuggestions === "" ? undefined : peerSuggestions,
        teamEmails: localTeamEmails(entry.subjectEmail, orgNodes, userIdByEmail, emailByUserId),
        direct: managed.direct.has(entry.subjectEmail.toLowerCase()),
      };
    });
  }

  return {
    requestsForYou: forYou.map((request) => ({
      id: request.id,
      subjectEmail: request.subjectEmail,
      subjectName: nameByEmail.get(request.subjectEmail.toLowerCase()),
      subjectTitle: titleByEmail.get(request.subjectEmail.toLowerCase()),
      kind: request.kind,
      status: request.status,
      declineReason: request.declineReason,
      submittedAt: request.submittedAt?.toISOString(),
    })),
    isReviewer,
    cases,
    myCase,
    directory: admins
      .filter((admin) => admin.active && admin.email.toLowerCase() !== effectiveEmail)
      .map((admin) => ({
        email: admin.email.toLowerCase(),
        name: `${admin.firstName} ${admin.lastName}`.trim(),
        title: admin.title,
      })),
  };
}

// Staff propose peer reviewers for their OWN case; the manager approves. The
// case auto-opens on first proposal (participation-gated in the DAL).
export async function peerProposeHandler(input: PeerProposeInput): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.respond");
  const adminDb = getDbAs("admin");
  const email = session.subject.email.toLowerCase();
  const reviewCase = await openCase(adminDb, email, REVIEW_CURRENT_CYCLE, auditContext(session));
  await proposePeerRequests(
    adminDb,
    reviewCase.id,
    session.actor.id,
    input.requests.filter((request) => request.email.toLowerCase() !== email),
    auditContext(session),
  );
  return { ok: true };
}

// Approve/reopen are the SUBJECT'S manager's calls (or leadership).
async function assertManagesRequestSubject(
  adminDb: ReturnType<typeof getDbAs>,
  session: Awaited<ReturnType<typeof requireSession>>,
  requestId: string,
  action: string,
): Promise<void> {
  const request = await getPeerRequestById(adminDb, requestId);
  if (request === undefined) {
    throw new NotFoundError("peer request", requestId);
  }
  if (request.subjectEmail.toLowerCase() === session.subject.email.toLowerCase()) {
    throw new ForbiddenError(action, "own_review");
  }
  if (isLeadership(session.subject.roles)) {
    return;
  }
  const managed = await managedEmailSets(adminDb, session.subject.id);
  if (!managed.all.has(request.subjectEmail.toLowerCase())) {
    throw new ForbiddenError(action, "not_subjects_manager");
  }
}

export async function peerApproveHandler(input: {
  readonly requestId: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.request");
  const adminDb = getDbAs("admin");
  await assertManagesRequestSubject(adminDb, session, input.requestId, "people.peer.request");
  await approvePeerRequest(adminDb, input.requestId, auditContext(session));
  return { ok: true };
}

export async function peerRejectHandler(input: {
  readonly requestId: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.request");
  const adminDb = getDbAs("admin");
  await assertManagesRequestSubject(adminDb, session, input.requestId, "people.peer.request");
  await rejectPeerRequest(adminDb, input.requestId, auditContext(session));
  return { ok: true };
}

export async function peerReopenHandler(input: {
  readonly requestId: string;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.peer.request");
  const adminDb = getDbAs("admin");
  await assertManagesRequestSubject(adminDb, session, input.requestId, "people.peer.request");
  await reopenPeerRequest(adminDb, input.requestId, auditContext(session));
  return { ok: true };
}

// The dedicated answer page's loader: requestee-only.
export async function peerAnswerHandler(requestId: string): Promise<PeerAnswerView> {
  const session = await requireSession("people.peer.respond");
  const adminDb = getDbAs("admin");
  const request = await getPeerRequestById(adminDb, requestId);
  if (request === undefined) {
    throw new NotFoundError("peer request", requestId);
  }
  if (request.requesteeEmail !== session.subject.email.toLowerCase()) {
    throw new ForbiddenError("people.peer.respond", "not_addressed_to_you");
  }
  const admins = isInsideConfigured() ? await listAdminDirectory({ limit: 1000 }) : [];
  const roster = admins.find(
    (admin) => admin.email.toLowerCase() === request.subjectEmail.toLowerCase(),
  );
  return {
    requestId: request.id,
    subjectEmail: request.subjectEmail,
    subjectName: roster === undefined ? undefined : `${roster.firstName} ${roster.lastName}`.trim(),
    subjectTitle: roster?.title,
    kind: request.kind,
    status: request.status,
    input: request.input,
    submittedAt: request.submittedAt?.toISOString(),
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
  if (reviewCase.subjectEmail.toLowerCase() === session.subject.email.toLowerCase()) {
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
    session.subject.email,
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
    session.subject.email,
    input.reason,
    auditContext(session),
  );
  return { ok: true };
}

// Assessment handlers (improve-ux plan): the list is the viewer's REPORTS —
// direct (either line) first, then indirect — each with review-readiness
// status. Leadership with no reports of their own falls back to the whole
// roster (as indirect). No one assesses themselves.
export async function assessListHandler(): Promise<readonly AssessReportRow[]> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  const effectiveEmail = session.subject.email.toLowerCase();
  const [admins, managed] = await Promise.all([
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
    managedEmailSets(adminDb, session.subject.id),
  ]);
  const rosterByEmail = new Map(admins.map((admin) => [admin.email.toLowerCase(), admin]));

  let scope = [...managed.all].filter((email) => email !== effectiveEmail);
  let directSet: ReadonlySet<string> = managed.direct;
  if (scope.length === 0 && isLeadership(session.subject.roles)) {
    scope = admins
      .filter((admin) => admin.active)
      .map((admin) => admin.email.toLowerCase())
      .filter((email) => email !== effectiveEmail);
    directSet = new Set<string>();
  }

  const rows = await Promise.all(
    scope.map(async (email): Promise<AssessReportRow> => {
      const roster = rosterByEmail.get(email);
      const [attrs, reviewCase] = await Promise.all([
        getEmployeeByEmail(adminDb, email),
        getCaseBySubject(adminDb, email, REVIEW_CURRENT_CYCLE),
      ]);
      const [selfReview, peerRequests, assessment] =
        reviewCase === undefined
          ? [undefined, [] as const, undefined]
          : await Promise.all([
              getSelfReviewByCase(adminDb, reviewCase.id),
              listPeerRequestsForCase(adminDb, reviewCase.id),
              getAssessmentByCase(adminDb, reviewCase.id),
            ]);
      const employmentType = attrs?.employmentType ?? "employee";
      const selfSubmitted = selfReview?.submittedAt !== undefined;
      const peersPending = peerRequests.filter(
        (request) => request.status === "pending" || request.status === "proposed",
      ).length;
      const peersSubmitted = peerRequests.filter(
        (request) => request.status === "submitted",
      ).length;
      return {
        email,
        name: roster !== undefined ? `${roster.firstName} ${roster.lastName}`.trim() : email,
        userId: roster?.userId,
        title: roster?.title,
        direct: directSet.has(email),
        inReviewCycle: participatesInReview(
          employmentType,
          attrs?.reviewParticipationOverride ?? null,
        ),
        caseId: reviewCase?.id,
        state: reviewCase?.state,
        selfSubmitted,
        peersPending,
        peersSubmitted,
        // Ready = evidence collection done: self-review submitted and no peer
        // request still open. The manager can then start the assessment.
        ready: reviewCase !== undefined && selfSubmitted && peersPending === 0,
        assessmentSubmitted: assessment?.submittedAt !== undefined,
      };
    }),
  );

  return rows.sort((left, right) => {
    if (left.direct !== right.direct) {
      return left.direct ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function assessDetailHandler(caseId: string): Promise<AssessCaseDetail> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  const reviewCase = await getCaseById(adminDb, caseId);
  if (reviewCase === undefined) {
    throw new NotFoundError("review case", caseId);
  }
  const subjectEmail = reviewCase.subjectEmail.toLowerCase();
  if (subjectEmail === session.subject.email.toLowerCase()) {
    throw new ForbiddenError("people.assessment.write", "own_review");
  }
  // Manager-graph gate: only the subject's managers (either line, any depth)
  // and leadership may open the assessment.
  const managed = await managedEmailSets(adminDb, session.subject.id);
  const leadership = isLeadership(session.subject.roles);
  if (!leadership && !managed.all.has(subjectEmail)) {
    throw new ForbiddenError("people.assessment.write", "not_subjects_manager");
  }

  const [attrs, selfReview, peerRequests, existing, admins] = await Promise.all([
    getEmployeeByEmail(adminDb, subjectEmail),
    getSelfReviewByCase(adminDb, caseId),
    listPeerRequestsForCase(adminDb, caseId),
    getAssessmentByCase(adminDb, caseId),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
  ]);
  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      `${admin.firstName} ${admin.lastName}`.trim(),
    ]),
  );
  return {
    caseId,
    subjectEmail: reviewCase.subjectEmail,
    subjectName: nameByEmail.get(subjectEmail),
    state: reviewCase.state,
    level: attrs?.level,
    path: attrs?.path,
    direct: managed.direct.has(subjectEmail),
    selfReview: (selfReview?.payload ?? {}) as AssessCaseDetail["selfReview"],
    selfReviewSubmittedAt: selfReview?.submittedAt?.toISOString(),
    peerSubmitted: peerRequests.filter((request) => request.status === "submitted").length,
    peerDeclined: peerRequests.filter((request) => request.status === "declined").length,
    peers: peerRequests
      .filter((request) => request.status === "submitted")
      .map((request) => ({
        requesteeEmail: request.requesteeEmail,
        requesteeName: nameByEmail.get(request.requesteeEmail),
        kind: request.kind,
        submittedAt: request.submittedAt?.toISOString(),
        input: request.input,
      })),
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

const toDraft = (input: AssessmentSaveInput, authorEmail: string): AssessmentDraft => ({
  dims: Object.fromEntries(
    Object.entries(input.dims).filter(([, value]) => value !== undefined),
  ) as AssessmentDraft["dims"],
  narrative: input.narrative,
  proposedRating:
    input.proposedRating === undefined ? undefined : (input.proposedRating as ReviewRating),
  promoProposed: input.promoProposed,
  compRec: input.compRec,
  p6Acknowledged: input.p6Acknowledged,
  authorEmail,
});

export async function assessSaveHandler(input: AssessmentSaveInput): Promise<{ ok: true }> {
  const session = await requireSession("people.assessment.write");
  await saveAssessment(
    getDbAs("admin"),
    input.caseId,
    toDraft(input, session.actor.email),
    auditContext(session),
  );
  return { ok: true };
}

export async function assessSubmitHandler(input: AssessmentSaveInput): Promise<{ ok: true }> {
  const session = await requireSession("people.assessment.write");
  const adminDb = getDbAs("admin");
  await submitAssessment(
    adminDb,
    input.caseId,
    toDraft(input, session.actor.email),
    auditContext(session),
  );
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

// Salary bands + campus coefficients (design: "Internal — used by CEO, COO &
// leadership"). Band figures are reference config, not a person's comp, so a
// normal (leadership-gated) read rather than an audited one. Founders edit the
// figures in place (people.band.manage); every write is audited.
export async function bandsHandler(): Promise<BandsView> {
  const session = await requireSession("people.comp.read");
  const adminDb = getDbAs("admin");
  const [bands, coefficients] = await Promise.all([
    listBands(adminDb),
    listCampusCoefficients(adminDb),
  ]);
  return {
    bands,
    coefficients,
    canManageBands: can(session.subject, "people.band.manage").allow,
  };
}

export async function setBandHandler(input: SetBandInput): Promise<{ ok: true }> {
  const session = await requireSession("people.band.manage");
  await upsertBand(
    getDbAs("admin"),
    {
      roleFamily: input.roleFamily.trim(),
      level: input.level,
      minEur: input.minEur,
      midEur: input.midEur,
      maxEur: input.maxEur,
    },
    auditContext(session),
  );
  return { ok: true };
}

// The Overview surface: the cycle timeline + the viewer's own case status.
// Managers and leadership get the needs-a-decision list scoped to their managed
// set (managers) or the full queue (leadership). Org-wide distribution lives on
// /calibration.
export async function overviewHandler(): Promise<OverviewData> {
  const session = await requireSession("people.directory.read");
  const adminDb = getDbAs("admin");
  const isReviewer = can(session.subject, "people.review.open").allow;
  const leadership = isLeadership(session.subject.roles);

  const [cases, admins, myCase, managed] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    isInsideConfigured() ? listAdminDirectory({ limit: 1000 }) : Promise.resolve([]),
    getCaseBySubject(adminDb, session.actor.email.toLowerCase(), REVIEW_CURRENT_CYCLE),
    isReviewer && !leadership
      ? managedEmailSets(adminDb, session.subject.id)
      : Promise.resolve(undefined),
  ]);

  const needsDecision: OverviewData["needsDecision"][number][] = [];
  const byEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      { userId: admin.userId, name: `${admin.firstName} ${admin.lastName}`.trim() },
    ]),
  );
  const inDecisionScope = (subjectEmail: string): boolean =>
    leadership || (managed?.all.has(subjectEmail) ?? false);
  for (const entry of cases) {
    if (
      (entry.state === "calibration" || entry.state === "decision") &&
      !entry.decided &&
      inDecisionScope(entry.subjectEmail.toLowerCase())
    ) {
      const roster = byEmail.get(entry.subjectEmail.toLowerCase());
      needsDecision.push({
        subjectEmail: entry.subjectEmail,
        name: roster?.name,
        userId: roster?.userId,
        rating: entry.rating,
      });
    }
  }

  return {
    cycle: REVIEW_CURRENT_CYCLE,
    isReviewer,
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

// The Appeals surface (design M9): one page — your own appeal state + the
// submit form inside the 30-day window for everyone; the queue for HR Admins.
export async function appealsPageHandler(): Promise<AppealsPageView> {
  const session = await requireSession("people.appeal.file");
  const adminDb = getDbAs("admin");
  const email = session.actor.email.toLowerCase();
  const canManage = can(session.subject, "people.appeal.manage").allow;

  const myCase = await getCaseBySubject(adminDb, email, REVIEW_CURRENT_CYCLE);
  const myAppeal = myCase === undefined ? undefined : await getAppealForCase(adminDb, myCase.id);
  const canAppealNow = canFileAppealNow({
    isSubject: true,
    appealUntilMs: myCase?.appealUntil?.getTime(),
    nowMs: Date.now(),
    alreadyFiled: myAppeal !== undefined,
  });

  const queue = canManage ? (await listAppeals(adminDb)).map(toAppealView) : [];

  return {
    canManage,
    queue,
    myAppeal: myAppeal === undefined ? undefined : toAppealView(myAppeal),
    myCaseId: myCase?.id,
    canAppealNow,
    appealUntil: myCase?.appealUntil?.toISOString(),
  };
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
