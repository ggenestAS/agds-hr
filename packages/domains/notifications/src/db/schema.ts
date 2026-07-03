import { integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Transactional outbox for email notifications (docs/plans/notifications.md,
// ADR 2026-07-04-notifications-and-cycle-tracking): producers enqueue INSIDE
// the producing transaction (like recordEvent), the drain cron sends via
// Resend. `dedupe_key` unique makes enqueue idempotent — re-running a producer
// or a digest job is a no-op. Rows are operational, not the compliance record
// (that stays in audit.events): append-then-update, no soft delete, no DELETE
// grant anywhere. Kind is an open dotted vocabulary (§5.4).
export const notificationsSchema = pgSchema("notifications");

export const outbox = notificationsSchema.table("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  payload: jsonb("payload").notNull().default({}),
  dedupeKey: text("dedupe_key").notNull().unique("outbox_dedupe_key"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
