import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "@agds-hr/auth/db/schema";

import {
  APPEAL_CATEGORIES,
  APPEAL_STATUSES,
  CAREER_LEVELS,
  CAREER_PATHS,
  PEER_KINDS,
  PEER_REQUEST_STATUSES,
  REVIEW_STATES,
} from "../types.ts";

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
    // Set at delivery (dual-founder sign-off): the decision timestamp, the
    // 30-day appeal deadline, and whether a P6 improvement plan was triggered.
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    appealUntil: timestamp("appeal_until", { withTimezone: true }),
    p6Triggered: boolean("p6_triggered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("review_case_subject_cycle").on(table.subjectEmail, table.cyclePeriod)],
);

// Compensation recommendation for a case (one per case). Amounts are whole EUR
// (France reference; country coefficient applied with judgment). Every READ of
// this data is recorded as an audit event — the audit trail is the product.
export const compRecommendation = peopleSchema.table(
  "comp_recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    currentBaseEur: integer("current_base_eur").notNull(),
    increaseEur: integer("increase_eur").notNull().default(0),
    bonusEur: integer("bonus_eur").notNull().default(0),
    newBaseEur: integer("new_base_eur").notNull(),
    effectiveDate: text("effective_date"),
    rationale: text("rationale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("comp_recommendation_case").on(table.caseId)],
);

// Appeals live in their own table so "excluded from any future performance view"
// is enforced by NOT joining them, not by remembering to filter (design). Routed
// to Admins; visible only to Admins and the appellant. One appeal per decision.
export const appealCategoryEnum = peopleSchema.enum("appeal_category", APPEAL_CATEGORIES);
export const appealStatusEnum = peopleSchema.enum("appeal_status", APPEAL_STATUSES);

export const appeal = peopleSchema.table(
  "appeal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    appellantEmail: text("appellant_email").notNull(),
    category: appealCategoryEnum("category").notNull(),
    statement: text("statement").notNull(),
    status: appealStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("appeal_case").on(table.caseId)],
);

// Founder sign-offs on a decision. Unique on [case, founder] so the two required
// confirmations must come from distinct founders (design: two distinct,
// authenticated confirmations).
export const reviewSignoff = peopleSchema.table(
  "review_signoff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    founderUserId: uuid("founder_user_id").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("review_signoff_case_founder").on(table.caseId, table.founderUserId)],
);

// The subject's self-review (design: "input, not the rating"). One per case;
// free-text sections stored as a validated string map. `submitted_at` is the
// sent-to-manager marker — drafts autosave locally, the server copy is written
// on explicit save/submit (bounded, audited mutations).
export const selfReview = peopleSchema.table(
  "self_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull().default({}),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("self_review_case").on(table.caseId)],
);

// Peer input requests (design M5): NAMED input — never anonymous, never shown
// to the person being reviewed. One request per requestee per case; the five-
// dimension free-text input lands on the same row at submission. Declines are
// allowed but logged with a reason.
export const peerKindEnum = peopleSchema.enum("peer_kind", PEER_KINDS);
export const peerRequestStatusEnum = peopleSchema.enum(
  "peer_request_status",
  PEER_REQUEST_STATUSES,
);

export const peerRequest = peopleSchema.table(
  "peer_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    requesteeEmail: text("requestee_email").notNull(),
    kind: peerKindEnum("kind").notNull(),
    status: peerRequestStatusEnum("status").notNull().default("pending"),
    declineReason: text("decline_reason"),
    input: jsonb("input").notNull().default({}),
    requestedBy: uuid("requested_by").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("peer_request_case_requestee").on(table.caseId, table.requesteeEmail)],
);

// The manager assessment (design M6): evidence-based — per-dimension score,
// narrative, and evidence, plus the proposed rating and the comp-recommendation
// TYPE (amounts are set by Admins at sign-off). Submission gates (every
// evidence field complete, P6 acknowledgment for low ratings) are enforced by
// the pure canSubmitAssessment helper at the DAL/handler layer.
export const assessment = peopleSchema.table(
  "assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reviewCase.id, { onDelete: "cascade" }),
    dims: jsonb("dims").notNull().default({}),
    narrative: text("narrative").notNull().default(""),
    proposedRating: integer("proposed_rating"),
    promoProposed: boolean("promo_proposed").notNull().default(false),
    compRec: text("comp_rec").notNull().default(""),
    p6Acknowledged: boolean("p6_acknowledged").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("assessment_case").on(table.caseId)],
);
