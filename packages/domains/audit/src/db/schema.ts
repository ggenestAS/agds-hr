import { index, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Append-only compliance record — no updatedAt, no soft delete: rows are
// never mutated, enforced by the forbid-mutation trigger shipped in the same
// migration (docs/decisions/2026-07-02-database-roles-and-migrations.md).
export const auditSchema = pgSchema("audit");

export const auditEvents = auditSchema.table(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").notNull(),
    subjectUserId: uuid("subject_user_id").notNull(),
    domain: text("domain").notNull(),
    eventType: text("event_type").notNull(),
    resourceId: text("resource_id"),
    payload: jsonb("payload").notNull().default({}),
    requestId: text("request_id").notNull(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_subject_created_idx").on(table.subjectUserId, table.createdAt),
    index("events_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("events_domain_type_idx").on(table.domain, table.eventType),
  ],
);
