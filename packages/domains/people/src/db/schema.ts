import { sql } from "drizzle-orm";
import { integer, pgSchema, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "@agds-hr/auth/db/schema";

import { CAREER_LEVELS, CAREER_PATHS, REVIEW_STATES } from "../types.ts";

// The people product domain (docs/decisions/2026-07-02-people-domain-model.md).
// `employee` is HR attributes on a provisioned auth.user, not a second account.
// Soft delete is the default (§5.3). Grants ship hand-added in the migration.
export const peopleSchema = pgSchema("people");

export const careerLevelEnum = peopleSchema.enum("career_level", CAREER_LEVELS);
export const careerPathEnum = peopleSchema.enum("career_path", CAREER_PATHS);

export const employee = peopleSchema.table(
  "employee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Reconciliation key: the directory roster comes from Inside (most staff are
    // not provisioned auth.user rows), so agds-hr attributes attach by verified
    // school email. `insideUserId` records the Inside id; `userId` links a
    // provisioned auth.user when one exists (nullable).
    email: text("email").notNull(),
    insideUserId: text("inside_user_id"),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    level: careerLevelEnum("level").notNull(),
    path: careerPathEnum("path").notNull(),
    // Inside is the source for country/role_family on the directory; kept
    // nullable here for the agds-hr-native path.
    country: text("country"),
    roleFamily: text("role_family"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  // Partial unique indexes on active rows (§5.3). `email` is the reconciliation
  // key (one active employee per email). The original `user_id` index is kept
  // (now over a nullable column, so it only constrains the provisioned-user
  // case) — retaining it keeps this migration add-only, avoiding a drizzle
  // rename prompt on an already-applied table (AGENTS.md).
  (table) => [
    uniqueIndex("employee_email_active")
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("employee_user_active")
      .on(table.userId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

// Reference tables — unseeded in slice 1, real config entered later. Integer
// money (whole EUR) and integer basis points (10000 = 1.00) rather than numeric,
// which Drizzle returns as a string (ADR).
export const band = peopleSchema.table(
  "band",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleFamily: text("role_family").notNull(),
    level: careerLevelEnum("level").notNull(),
    minEur: integer("min_eur").notNull(),
    midEur: integer("mid_eur").notNull(),
    maxEur: integer("max_eur").notNull(),
  },
  (table) => [unique("band_family_level").on(table.roleFamily, table.level)],
);

export const countryCoefficient = peopleSchema.table("country_coefficient", {
  country: text("country").primaryKey(),
  coefficientBp: integer("coefficient_bp").notNull(),
});

// One annual-review case per person per cycle. Cases are the compliance record —
// no soft delete (the audit trail is the product). `rating` (1–4) is set at the
// manager-assessment stage. Subject is keyed by email like `employee`.
export const reviewStateEnum = peopleSchema.enum("review_state", REVIEW_STATES);

export const reviewCase = peopleSchema.table(
  "review_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectEmail: text("subject_email").notNull(),
    cyclePeriod: text("cycle_period").notNull(),
    state: reviewStateEnum("state").notNull().default("self_review"),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("review_case_subject_cycle").on(table.subjectEmail, table.cyclePeriod)],
);
