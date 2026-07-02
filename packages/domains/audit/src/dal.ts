import { and, desc, eq, type SQL } from "drizzle-orm";

import type { DrizzleDb, DrizzleExecutor } from "@agds-hr/db";
import { AuditEventId, RequestId, UserId } from "@agds-hr/shared";

import { auditEvents } from "./db/schema.ts";
import type { AuditEvent } from "./types.ts";

export type RecordEventInput = {
  readonly actorUserId: UserId;
  readonly subjectUserId: UserId;
  readonly domain: string;
  readonly eventType: string;
  readonly resourceId?: string;
  readonly payload: Record<string, unknown>;
  readonly requestId: RequestId;
  readonly ip?: string;
};

// Called inside the owning domain's write transaction so state + audit commit
// or roll back together (docs/new-project-directives.md §8.2). Throws on
// failure by design — a write that cannot be audited must not land.
export async function recordEvent(
  executor: DrizzleExecutor,
  input: RecordEventInput,
): Promise<void> {
  await executor.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectUserId,
    domain: input.domain,
    eventType: input.eventType,
    resourceId: input.resourceId ?? null,
    payload: input.payload,
    requestId: input.requestId,
    ip: input.ip ?? null,
  });
}

export type ListEventsFilter = {
  readonly domain?: string;
  readonly eventType?: string;
  readonly actorUserId?: UserId;
  readonly subjectUserId?: UserId;
  readonly limit?: number;
};

// Privileged reads of the audit surface are themselves recorded as audit
// events — that is the caller's job (it has the session; this DAL does not).
export async function listEvents(
  db: DrizzleDb,
  filter: ListEventsFilter = {},
): Promise<readonly AuditEvent[]> {
  const conditions: SQL[] = [];
  if (filter.domain !== undefined) {
    conditions.push(eq(auditEvents.domain, filter.domain));
  }
  if (filter.eventType !== undefined) {
    conditions.push(eq(auditEvents.eventType, filter.eventType));
  }
  if (filter.actorUserId !== undefined) {
    conditions.push(eq(auditEvents.actorUserId, filter.actorUserId));
  }
  if (filter.subjectUserId !== undefined) {
    conditions.push(eq(auditEvents.subjectUserId, filter.subjectUserId));
  }

  const rows = await db
    .select()
    .from(auditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(filter.limit ?? 100);

  return rows.map((row) => ({
    id: AuditEventId(row.id),
    actorUserId: UserId(row.actorUserId),
    subjectUserId: UserId(row.subjectUserId),
    domain: row.domain,
    eventType: row.eventType,
    resourceId: row.resourceId ?? undefined,
    payload: row.payload as Record<string, unknown>,
    requestId: RequestId(row.requestId),
    ip: row.ip ?? undefined,
    createdAt: row.createdAt,
  }));
}
