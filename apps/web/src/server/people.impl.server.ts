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
  getEmployeeByEmail,
  listEmployeeAttrs,
  listRatingsForCycle,
  openCase,
  REVIEW_CURRENT_CYCLE,
  REVIEW_TRANSITIONS,
  setCaseRating,
  upsertEmployeeByEmail,
} from "@agds-hr/people";
import type { ReviewRating } from "@agds-hr/people/types";
import { NotFoundError } from "@agds-hr/shared";

import type { DirectoryEntry, PersonDetail, SetEmployeeAttrsInput } from "./people.shared.ts";
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
          },
    canManage: can(session.subject, "people.employee.manage").allow,
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
  const session = await requireSession("people.review.manage");
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
  const session = await requireSession("people.review.manage");
  await advanceCase(getDbAs("admin"), input.caseId, input.toState, auditContext(session));
  return { ok: true };
}

export async function setRatingHandler(input: {
  readonly caseId: string;
  readonly rating: number;
}): Promise<{ ok: true }> {
  const session = await requireSession("people.review.manage");
  await setCaseRating(
    getDbAs("admin"),
    input.caseId,
    input.rating as ReviewRating,
    auditContext(session),
  );
  return { ok: true };
}
