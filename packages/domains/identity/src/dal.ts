import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { recordEvent, type AuditContext } from "@agds-hr/audit";
import { user } from "@agds-hr/auth/db/schema";
import type { HydratedUser } from "@agds-hr/auth";
import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { UserId, type UserRole } from "@agds-hr/shared";

import { impersonationSession, userRelationship, userRole } from "./db/schema.ts";
import { LOCAL_REPORTS_TO, REPORTS_TO, type DirectoryUser } from "./types.ts";

// Reads are executor-agnostic and carry no audit context; mutations own their
// transaction and take AuditContext last (docs/new-project-directives.md §8.1).
// Policy checks (assertCan) are the caller's job at the server-fn layer — the
// audit row needs actor+subject, which the DAL never sees.

async function readRoles(db: DrizzleExecutor, userId: UserId): Promise<readonly UserRole[]> {
  const rows = await db
    .select({ role: userRole.role })
    .from(userRole)
    .where(eq(userRole.userId, userId));
  return rows.map((row) => row.role);
}

// resolveSession's hydrateUser dep: actor identity + roles + manager graph, plus
// deactivation state so the resolver can fail closed (§6.2).
//
// Admin-connection only: this selects auth.user.email, and runtime roles
// (app/readonly) have column grants on auth.user's app-owned columns only, never
// email (§6.1). Session resolution is a privileged read, so the composition root
// wires this over getDbAs("admin"). Same for listUsers below.
export async function hydrateUser(
  db: DrizzleExecutor,
  userId: UserId,
): Promise<HydratedUser | undefined> {
  const [row] = await db
    .select({ id: user.id, email: user.email, deactivatedAt: user.deactivatedAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (row === undefined) {
    return undefined;
  }

  const roles = await readRoles(db, userId);

  const reportsToRows = await db
    .select({ relatedUserId: userRelationship.relatedUserId })
    .from(userRelationship)
    .where(and(eq(userRelationship.userId, userId), eq(userRelationship.kind, REPORTS_TO)));
  const managesRows = await db
    .select({ userId: userRelationship.userId })
    .from(userRelationship)
    .where(and(eq(userRelationship.relatedUserId, userId), eq(userRelationship.kind, REPORTS_TO)));
  const localReportsToRows = await db
    .select({ relatedUserId: userRelationship.relatedUserId })
    .from(userRelationship)
    .where(and(eq(userRelationship.userId, userId), eq(userRelationship.kind, LOCAL_REPORTS_TO)));
  const localManagesRows = await db
    .select({ userId: userRelationship.userId })
    .from(userRelationship)
    .where(
      and(eq(userRelationship.relatedUserId, userId), eq(userRelationship.kind, LOCAL_REPORTS_TO)),
    );

  return {
    id: UserId(row.id),
    email: row.email,
    roles,
    relationships: {
      reportsTo: reportsToRows.map((edge) => UserId(edge.relatedUserId)),
      manages: managesRows.map((edge) => UserId(edge.userId)),
      localReportsTo: localReportsToRows.map((edge) => UserId(edge.relatedUserId)),
      localManages: localManagesRows.map((edge) => UserId(edge.userId)),
    },
    deactivatedAt: row.deactivatedAt,
  };
}

export async function readActiveImpersonation(
  db: DrizzleExecutor,
  actorUserId: UserId,
): Promise<UserId | null> {
  const [row] = await db
    .select({ subjectUserId: impersonationSession.subjectUserId })
    .from(impersonationSession)
    .where(eq(impersonationSession.actorUserId, actorUserId))
    .limit(1);
  return row === undefined ? null : UserId(row.subjectUserId);
}

export type ListUsersFilter = { readonly includeDeactivated?: boolean; readonly limit?: number };

export type ReportingLineEdge = {
  readonly userId: UserId;
  readonly managerUserId: UserId;
  readonly kind: typeof REPORTS_TO | typeof LOCAL_REPORTS_TO;
};

const SYNCED_REPORTING_LINE_KINDS = [REPORTS_TO, LOCAL_REPORTS_TO] as const;

// Replace Inside-sourced reporting lines wholesale. Inside is the source of
// truth for both functional (`reports_to`) and local (`local_reports_to`) chains;
// the sync deletes prior rows of those kinds before inserting the new set.
export async function syncReportingLines(
  db: DrizzleDb,
  edges: readonly ReportingLineEdge[],
  context: AuditContext,
): Promise<{ readonly inserted: number; readonly removed: number }> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(userRelationship)
      .where(inArray(userRelationship.kind, [...SYNCED_REPORTING_LINE_KINDS]))
      .returning({ id: userRelationship.id });
    if (edges.length > 0) {
      await tx.insert(userRelationship).values(
        edges.map((edge) => ({
          userId: edge.userId,
          relatedUserId: edge.managerUserId,
          kind: edge.kind,
        })),
      );
    }
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.reporting_lines.synced",
      resourceId: context.actorUserId,
      payload: {
        inserted: edges.length,
        removed: removed.length,
        kinds: [...SYNCED_REPORTING_LINE_KINDS],
      },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
    return { inserted: edges.length, removed: removed.length };
  });
}

// Admin-connection only (reads auth.user.email — see hydrateUser).
export async function listUsers(
  db: DrizzleExecutor,
  filter: ListUsersFilter = {},
): Promise<readonly DirectoryUser[]> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .where(filter.includeDeactivated === true ? undefined : isNull(user.deactivatedAt))
    .orderBy(user.email)
    .limit(filter.limit ?? 200);

  const directory: DirectoryUser[] = [];
  for (const row of rows) {
    directory.push({
      id: UserId(row.id),
      email: row.email,
      displayName: row.displayName ?? undefined,
      roles: await readRoles(db, UserId(row.id)),
      deactivatedAt: row.deactivatedAt ?? undefined,
    });
  }
  return directory;
}

// Provisioning primitive (§6.1 — users are provisioned before they can sign in;
// also the seam step 7's createTestUser and the dev-login bypass build on).
// Find-or-create by email on the admin connection; returns the id either way.
// Not audited by itself — this is bootstrap/provisioning, like the documented
// one-time SQL insert; audited role grants are layered on by the caller.
export async function ensureUserByEmail(
  db: DrizzleDb,
  email: string,
  name: string,
): Promise<UserId> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existing !== undefined) {
    return UserId(existing.id);
  }
  const [row] = await db
    .insert(user)
    .values({ name, email, emailVerified: true, displayName: name })
    .returning({ id: user.id });
  return UserId(row!.id);
}

export async function grantRole(
  db: DrizzleDb,
  userId: UserId,
  role: UserRole,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(userRole)
      .values({ userId, role, grantedBy: context.actorUserId })
      .onConflictDoNothing();
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.role.granted",
      resourceId: userId,
      payload: { role },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function revokeRole(
  db: DrizzleDb,
  userId: UserId,
  role: UserRole,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userRole).where(and(eq(userRole.userId, userId), eq(userRole.role, role)));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.role.revoked",
      resourceId: userId,
      payload: { role },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function deactivateUser(
  db: DrizzleDb,
  userId: UserId,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ deactivatedAt: sql`now()` })
      .where(and(eq(user.id, userId), isNull(user.deactivatedAt)));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.user.deactivated",
      resourceId: userId,
      payload: { deactivatedAt: { before: null, after: "now" } },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function reactivateUser(
  db: DrizzleDb,
  userId: UserId,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(user).set({ deactivatedAt: null }).where(eq(user.id, userId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.user.reactivated",
      resourceId: userId,
      payload: { deactivatedAt: { before: "set", after: null } },
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function startImpersonation(
  db: DrizzleDb,
  actorUserId: UserId,
  subjectUserId: UserId,
  reason: string | undefined,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(impersonationSession)
      .values({ actorUserId, subjectUserId, reason: reason ?? null })
      .onConflictDoUpdate({
        target: impersonationSession.actorUserId,
        set: { subjectUserId, reason: reason ?? null, startedAt: sql`now()` },
      });
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId,
      domain: "identity",
      eventType: "identity.impersonation.started",
      resourceId: subjectUserId,
      payload: reason !== undefined ? { reason } : {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}

export async function stopImpersonation(
  db: DrizzleDb,
  actorUserId: UserId,
  context: AuditContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(impersonationSession).where(eq(impersonationSession.actorUserId, actorUserId));
    await recordEvent(tx, {
      actorUserId: context.actorUserId,
      subjectUserId: context.subjectUserId,
      domain: "identity",
      eventType: "identity.impersonation.stopped",
      resourceId: actorUserId,
      payload: {},
      requestId: context.requestId,
      ...(context.ip ? { ip: context.ip } : {}),
    });
  });
}
