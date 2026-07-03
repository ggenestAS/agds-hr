// Sync active Albert Inside admin staff into people.employee and both reporting
// lines (functional + local) into identity.user_relationship. Skips employee
// rows that already exist unless --force is passed; reporting lines are always
// replaced from Inside. Loaded with .env — run from repo root:
//   bun --env-file=.env scripts/ops/sync-inside-directory.ts [--force]
import { getDbAs } from "@agds-hr/db";
import {
  ensureUserByEmail,
  LOCAL_REPORTS_TO,
  REPORTS_TO,
  syncReportingLines,
  type ReportingLineEdge,
} from "@agds-hr/identity";
import { isInsideConfigured, listAdminDirectory, listOrgTree, type OrgNode } from "@agds-hr/inside";
import { getEmployeeByEmail, upsertEmployeeByEmail } from "@agds-hr/people";
import { RequestId, type UserId } from "@agds-hr/shared";

const ACTOR_EMAIL = "ggenest@albertschool.com";
const DEFAULT_LEVEL = "L1" as const;
const DEFAULT_EMPLOYMENT_TYPE = "employee" as const;

const force = process.argv.includes("--force");

if (!isInsideConfigured()) {
  console.error("inside_not_configured: set INSIDE_API_KEY in .env");
  process.exit(1);
}

const adminDb = getDbAs("admin");
const actorUserId = await ensureUserByEmail(adminDb, ACTOR_EMAIL, "Guillaume Genest");
const auditContext = {
  actorUserId,
  subjectUserId: actorUserId,
  requestId: RequestId(crypto.randomUUID()),
};

const [admins, orgNodes] = await Promise.all([listAdminDirectory({ limit: 1000 }), listOrgTree()]);

const activeAdmins = admins.filter((admin) => admin.active);
const insideIdToAuthId = new Map<string, UserId>();

for (const admin of activeAdmins) {
  const displayName = `${admin.firstName} ${admin.lastName}`.trim();
  const authId = await ensureUserByEmail(adminDb, admin.email.toLowerCase(), displayName);
  insideIdToAuthId.set(admin.userId, authId);
}

const directReportCounts = new Map<string, number>();
for (const node of orgNodes) {
  const managerIds = new Set<string>();
  if (node.functionalManagerUserId !== undefined) {
    managerIds.add(node.functionalManagerUserId);
  }
  if (node.localManagerUserId !== undefined) {
    managerIds.add(node.localManagerUserId);
  }
  for (const managerInsideId of managerIds) {
    directReportCounts.set(managerInsideId, (directReportCounts.get(managerInsideId) ?? 0) + 1);
  }
}

let inserted = 0;
let skipped = 0;
let updated = 0;

for (const admin of activeAdmins) {
  const email = admin.email.toLowerCase();
  const existing = await getEmployeeByEmail(adminDb, email);
  if (existing !== undefined && !force) {
    skipped += 1;
    continue;
  }
  const path = (directReportCounts.get(admin.userId) ?? 0) > 0 ? "manager" : "ic";
  await upsertEmployeeByEmail(
    adminDb,
    {
      email,
      level: DEFAULT_LEVEL,
      path,
      employmentType: DEFAULT_EMPLOYMENT_TYPE,
      reviewParticipationOverride: null,
      insideUserId: admin.userId,
    },
    auditContext,
  );
  if (existing === undefined) {
    inserted += 1;
  } else {
    updated += 1;
  }
}

const reportingEdges = buildReportingEdges(orgNodes, insideIdToAuthId);
const relationships = await syncReportingLines(adminDb, reportingEdges, auditContext);

console.log(
  JSON.stringify(
    {
      ok: true,
      force,
      roster: activeAdmins.length,
      employees: { inserted, updated, skipped },
      relationships: {
        functional: reportingEdges.filter((edge) => edge.kind === REPORTS_TO).length,
        local: reportingEdges.filter((edge) => edge.kind === LOCAL_REPORTS_TO).length,
        ...relationships,
      },
    },
    null,
    2,
  ),
);

function buildReportingEdges(
  nodes: readonly OrgNode[],
  insideIdToAuthId: ReadonlyMap<string, UserId>,
): ReportingLineEdge[] {
  const edges: ReportingLineEdge[] = [];
  for (const node of nodes) {
    appendEdge(edges, node, node.functionalManagerUserId, REPORTS_TO, insideIdToAuthId);
    appendEdge(edges, node, node.localManagerUserId, LOCAL_REPORTS_TO, insideIdToAuthId);
  }
  return edges;
}

function appendEdge(
  edges: ReportingLineEdge[],
  node: OrgNode,
  managerInsideId: string | undefined,
  kind: typeof REPORTS_TO | typeof LOCAL_REPORTS_TO,
  insideIdToAuthId: ReadonlyMap<string, UserId>,
): void {
  if (managerInsideId === undefined) {
    return;
  }
  const userId = insideIdToAuthId.get(node.userId);
  const managerUserId = insideIdToAuthId.get(managerInsideId);
  if (userId === undefined || managerUserId === undefined) {
    return;
  }
  edges.push({ userId, managerUserId, kind });
}
