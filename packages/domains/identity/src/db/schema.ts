import { pgSchema, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "@agds-hr/auth/db/schema";
import { USER_ROLES } from "@agds-hr/shared";

// Identity owns roles, relationships, and impersonation
// (docs/decisions/2026-07-02-auth-identity-session-and-policy.md). The role
// pg enum is built from the single-source `USER_ROLES` tuple in @agds-hr/shared
// (§5.4); adding a role edits the tuple, never this file. Grants ship
// hand-added in the migration.
export const identitySchema = pgSchema("identity");

// The pg enum is named `role` (not `user_role`): in Postgres a type and a
// table share one namespace within a schema, and the table below is
// `user_role`, so the type must differ.
export const userRoleEnum = identitySchema.enum("role", USER_ROLES);

export const userRole = identitySchema.table(
  "user_role",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

// The manager/report graph. `kind` is an open vocabulary (`domain.entity.verb`
// discipline for events, dotted strings for graph edges), e.g. `reports_to`.
export const userRelationship = identitySchema.table(
  "user_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    relatedUserId: uuid("related_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_relationship_edge").on(table.userId, table.relatedUserId, table.kind)],
);

// One active impersonation per actor (PK actor_user_id): the actor is "viewing
// as" the subject. Starting/stopping is an audited identity action (§6.2).
export const impersonationSession = identitySchema.table("impersonation_session", {
  actorUserId: uuid("actor_user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  subjectUserId: uuid("subject_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});
