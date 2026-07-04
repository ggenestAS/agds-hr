import { getDbAs } from "@agds-hr/db";
import { listReportingEdges, listUsers, managedUserIds } from "@agds-hr/identity";
import {
  isInsideConfigured,
  listAdminDirectory,
  listOrgTree,
  type InsideAdmin,
  type OrgNode,
} from "@agds-hr/inside";
import {
  computeObligations,
  getAssessmentByCase,
  getSignoffs,
  isPeerQuotaMet,
  listCasesForCycle,
  listPeerRequestsForCases,
  listSelfReviewsByCases,
  REVIEW_CURRENT_CYCLE,
} from "@agds-hr/people";
import type { CalibrationCase, Obligation, ObligationCaseInput } from "@agds-hr/people";

import { directManagerEmails, resolvePeerInputQuota } from "./people.impl.server.ts";

// Assembles the inputs for computeObligations from the DALs and the org graph
// — the ONE place cycle state is gathered, shared by the tracking board, the
// dashboard pending block, and the weekly digest job (docs/plans/
// notifications.md: one brain, several mouths).

export type CycleCaseDetail = {
  readonly base: CalibrationCase;
  readonly selfSubmitted: boolean;
  readonly peersSubmitted: number;
  readonly peersPending: number;
  readonly quotaMet: boolean;
  readonly assessmentSubmitted: boolean;
  readonly signoffCount: number;
};

export type CycleObligations = {
  readonly obligations: readonly Obligation[];
  readonly caseDetails: readonly CycleCaseDetail[];
  // manager email -> every subject email they manage (either line, any depth).
  readonly reportsByManager: ReadonlyMap<string, ReadonlySet<string>>;
  readonly founderEmails: readonly string[];
  readonly hrEmails: readonly string[];
  readonly nameByEmail: ReadonlyMap<string, { readonly name: string; readonly userId: string }>;
};

async function loadRoster(): Promise<readonly InsideAdmin[]> {
  if (!isInsideConfigured()) {
    return [];
  }
  try {
    return await listAdminDirectory({ limit: 1000 });
  } catch {
    return [];
  }
}

async function loadOrgTree(): Promise<readonly OrgNode[]> {
  if (!isInsideConfigured()) {
    return [];
  }
  try {
    return await listOrgTree();
  } catch {
    return [];
  }
}

export async function collectCycleObligations(
  adminDb: ReturnType<typeof getDbAs>,
): Promise<CycleObligations> {
  const [cases, admins, orgNodes, users, edges] = await Promise.all([
    listCasesForCycle(adminDb, REVIEW_CURRENT_CYCLE),
    loadRoster(),
    loadOrgTree(),
    listUsers(adminDb, { limit: 500 }),
    listReportingEdges(adminDb),
  ]);

  const caseIds = cases.map((entry) => entry.caseId);
  const [selfReviews, peerRequests, assessments, signoffCounts] = await Promise.all([
    listSelfReviewsByCases(adminDb, caseIds),
    listPeerRequestsForCases(adminDb, caseIds),
    Promise.all(cases.map((entry) => getAssessmentByCase(adminDb, entry.caseId))),
    Promise.all(
      cases.map(async (entry) =>
        entry.state === "decision" ? (await getSignoffs(adminDb, entry.caseId)).length : 0,
      ),
    ),
  ]);

  const selfByCase = new Map(selfReviews.map((row) => [row.caseId, row]));
  const requestsByCase = new Map<string, (typeof peerRequests)[number][]>();
  for (const request of peerRequests) {
    const bucket = requestsByCase.get(request.caseId);
    if (bucket === undefined) {
      requestsByCase.set(request.caseId, [request]);
    } else {
      bucket.push(request);
    }
  }
  const userIdByEmail = new Map(admins.map((admin) => [admin.email.toLowerCase(), admin.userId]));

  const caseInputs: ObligationCaseInput[] = [];
  const caseDetails: CycleCaseDetail[] = [];
  cases.forEach((entry, index) => {
    const subjectEmail = entry.subjectEmail.toLowerCase();
    const requests = requestsByCase.get(entry.caseId) ?? [];
    const quota = resolvePeerInputQuota(subjectEmail, orgNodes, userIdByEmail);
    const selfRow = selfByCase.get(entry.caseId);
    const assessment = assessments[index];
    const input: ObligationCaseInput = {
      caseId: entry.caseId,
      subjectEmail,
      cyclePeriod: REVIEW_CURRENT_CYCLE,
      state: entry.state,
      decided: entry.decided,
      caseCreatedAt: entry.createdAt,
      selfSubmittedAt: selfRow?.submittedAt,
      peerRequests: requests.map((request) => ({
        requesteeEmail: request.requesteeEmail,
        kind: request.kind,
        status: request.status,
        createdAt: request.createdAt,
      })),
      peerQuota: quota,
      assessmentSubmittedAt: assessment?.submittedAt,
      signoffCount: signoffCounts[index] ?? 0,
      managerEmails: directManagerEmails(subjectEmail, admins, orgNodes),
    };
    caseInputs.push(input);
    caseDetails.push({
      base: entry,
      selfSubmitted: selfRow?.submittedAt !== undefined,
      peersSubmitted: requests.filter((request) => request.status === "submitted").length,
      peersPending: requests.filter(
        (request) => request.status === "pending" || request.status === "proposed",
      ).length,
      // The same gate the advance handler enforces (peer_input cannot leave
      // until met); meaningful mainly while the case is collecting peer input.
      quotaMet: isPeerQuotaMet(requests, quota),
      assessmentSubmitted: assessment?.submittedAt !== undefined,
      signoffCount: signoffCounts[index] ?? 0,
    });
  });

  // Manager digests and tracking scope use the identity reporting graph (both
  // lines, any depth) — the same source the assessment/tracking handlers scope
  // by, so what a manager is chased for matches what they can see.
  const emailById = new Map(users.map((entry) => [entry.id as string, entry.email.toLowerCase()]));
  const managerIds = new Set(edges.map((edge) => edge.managerUserId));
  const reportsByManager = new Map<string, ReadonlySet<string>>();
  for (const managerId of managerIds) {
    const managerEmail = emailById.get(managerId as string);
    if (managerEmail === undefined) {
      continue;
    }
    const sets = managedUserIds(edges, managerId);
    const reportEmails = new Set(
      [...sets.all]
        .map((id) => emailById.get(id as string))
        .filter((email): email is string => email !== undefined),
    );
    if (reportEmails.size > 0) {
      reportsByManager.set(managerEmail, reportEmails);
    }
  }

  const founderEmails = users
    .filter((entry) => entry.roles.includes("founder"))
    .map((entry) => entry.email.toLowerCase());
  const hrEmails = users
    .filter((entry) => entry.roles.includes("admin") || entry.roles.includes("founder"))
    .map((entry) => entry.email.toLowerCase());

  const nameByEmail = new Map(
    admins.map((admin) => [
      admin.email.toLowerCase(),
      { name: `${admin.firstName} ${admin.lastName}`.trim(), userId: admin.userId },
    ]),
  );

  return {
    obligations: computeObligations(caseInputs, founderEmails),
    caseDetails,
    reportsByManager,
    founderEmails,
    hrEmails,
    nameByEmail,
  };
}
