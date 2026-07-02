import type { UserRole } from "@agds-hr/shared";

// Bounded job-architecture sets follow the closed-enum pipeline (§5.4): one
// `as const` tuple drives the TS union, the pg enum, and Zod. Level names are
// L1..L4 placeholders pending Albert's canonical ladder (refinable via a tuple
// edit + migration). Neither path is superior.
export const CAREER_LEVELS = ["L1", "L2", "L3", "L4"] as const;
export type CareerLevel = (typeof CAREER_LEVELS)[number];
export const isCareerLevel = (value: string): value is CareerLevel =>
  (CAREER_LEVELS as readonly string[]).includes(value);

export const CAREER_PATHS = ["ic", "manager"] as const;
export type CareerPath = (typeof CAREER_PATHS)[number];
export const isCareerPath = (value: string): value is CareerPath =>
  (CAREER_PATHS as readonly string[]).includes(value);

// The annual-review case state machine (the design's flow). A case moves forward
// through the stages; a delivered decision may be appealed. Rich stage gates
// (LT peer-input quota, evidence-gated assessment, dual-founder sign-off, the
// 30-day appeal clock, P6 auto-trigger) are deferred sub-slices layered on these
// transitions.
export const REVIEW_STATES = [
  "self_review",
  "peer_input",
  "manager_assessment",
  "calibration",
  "decision",
  "appeal",
  "closed",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
export const isReviewState = (value: string): value is ReviewState =>
  (REVIEW_STATES as readonly string[]).includes(value);

// Allowed forward transitions per state (self_review may skip peer input for
// non-LT members; a delivered decision may be appealed or closed).
export const REVIEW_TRANSITIONS: Record<ReviewState, readonly ReviewState[]> = {
  self_review: ["peer_input", "manager_assessment"],
  peer_input: ["manager_assessment"],
  manager_assessment: ["calibration"],
  calibration: ["decision"],
  decision: ["appeal", "closed"],
  appeal: ["closed"],
  closed: [],
};

export function canTransition(from: ReviewState, to: ReviewState): boolean {
  return REVIEW_TRANSITIONS[from].includes(to);
}

// Roles allowed to advance a case INTO each state (mapped to the design:
// managers run the assessment and submit to calibration; founders (CEO/COO) own
// calibration sign-off and the decision; admins handle appeals/closure).
// `developer` is the platform superuser. The decision itself is a dual-founder
// sign-off (a guarded accumulation), not a bare advance — see the review-decision
// slice. Manager-of-subject scoping (a manager may only act on their own reports)
// is a deferred refinement.
export const REVIEW_ADVANCE_ROLES: Record<ReviewState, readonly UserRole[]> = {
  self_review: [],
  peer_input: ["manager", "founder", "developer"],
  manager_assessment: ["manager", "founder", "developer"],
  calibration: ["manager", "founder", "developer"],
  decision: ["founder", "developer"],
  appeal: ["admin", "founder", "developer"],
  closed: ["founder", "admin", "developer"],
};

// Roles that may open a case or set a rating (the manager assessment produces
// the rating).
export const REVIEW_AUTHORITY_ROLES: readonly UserRole[] = [
  "manager",
  "founder",
  "admin",
  "developer",
];
export const REVIEW_RATING_ROLES: readonly UserRole[] = ["manager", "founder", "developer"];

// Calibrated performance rating, 1–4 (rated against level). 4 stays rare.
export const REVIEW_RATINGS = [1, 2, 3, 4] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];
export const isReviewRating = (value: number): value is ReviewRating =>
  (REVIEW_RATINGS as readonly number[]).includes(value);

// The single active review cycle (the design's 2026 cycle: one annual review in
// July–August, decisions effective September, mid-year check-in in January).
export const REVIEW_CURRENT_CYCLE = "2026";

export type ReviewCase = {
  readonly id: string;
  readonly subjectEmail: string;
  readonly cyclePeriod: string;
  readonly state: ReviewState;
  readonly rating: ReviewRating | undefined;
  readonly decidedAt: Date | undefined;
  readonly appealUntil: Date | undefined;
  readonly p6Triggered: boolean;
};

// A decision requires two distinct, authenticated founder confirmations before
// the summary is delivered (design). Sign-off is a guarded accumulation, not a
// plain state transition — delivery fires only when the distinct count reaches
// this threshold.
export const REVIEW_SIGNOFFS_REQUIRED = 2;

export function isDecisionComplete(distinctSignoffCount: number): boolean {
  return distinctSignoffCount >= REVIEW_SIGNOFFS_REQUIRED;
}

// Delivering the decision starts the appeal clock (anyone may appeal within 30
// days of delivery) and auto-triggers a P6 improvement plan for ratings of 1–2.
export const APPEAL_WINDOW_DAYS = 30;

export function isP6Triggered(rating: ReviewRating | undefined): boolean {
  return rating !== undefined && rating <= 2;
}

// --- Compensation ----------------------------------------------------------
// Band position: where a base sits within its role×level band, 0–100%. Clamped;
// a degenerate band (max <= min) reads as mid.
export function bandPositionPct(baseEur: number, minEur: number, maxEur: number): number {
  if (maxEur <= minEur) {
    return 50;
  }
  const pct = ((baseEur - minEur) / (maxEur - minEur)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Merit matrix — suggested increase by rating × position in band (design:
// "Guide, not a formula"). Low-in-band + high rating earns the most; high-in-band
// earns less; rating 1 gets nothing (a P6 plan, not a raise). Values are basis
// points (900 = 9.00%) and are placeholder config pending Albert's real matrix.
export type BandThird = "low" | "mid" | "high";
export const MERIT_MATRIX_BP: Record<ReviewRating, Record<BandThird, number>> = {
  4: { low: 1200, mid: 800, high: 400 },
  3: { low: 800, mid: 500, high: 200 },
  2: { low: 300, mid: 100, high: 0 },
  1: { low: 0, mid: 0, high: 0 },
};

export function bandThird(positionPct: number): BandThird {
  if (positionPct < 34) {
    return "low";
  }
  return positionPct < 67 ? "mid" : "high";
}

// Suggested merit increase (basis points) for a rating at a band position.
export function meritIncreaseBp(rating: ReviewRating, positionPct: number): number {
  return MERIT_MATRIX_BP[rating][bandThird(positionPct)];
}

export type Band = {
  readonly roleFamily: string;
  readonly level: CareerLevel;
  readonly minEur: number;
  readonly midEur: number;
  readonly maxEur: number;
};

export type CompRecommendation = {
  readonly currentBaseEur: number;
  readonly increaseEur: number;
  readonly bonusEur: number;
  readonly newBaseEur: number;
  readonly effectiveDate: string | undefined;
  readonly rationale: string | undefined;
};

// --- Appeals ---------------------------------------------------------------
// What is being appealed (design: Rating / Raise / Band placement / Exception).
export const APPEAL_CATEGORIES = ["rating", "raise", "band", "exception"] as const;
export type AppealCategory = (typeof APPEAL_CATEGORIES)[number];
export const isAppealCategory = (value: string): value is AppealCategory =>
  (APPEAL_CATEGORIES as readonly string[]).includes(value);

export const APPEAL_STATUSES = ["open", "resolved"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export type Appeal = {
  readonly id: string;
  readonly caseId: string;
  readonly appellantEmail: string;
  readonly category: AppealCategory;
  readonly statement: string;
  readonly status: AppealStatus;
  readonly resolution: string | undefined;
  readonly createdAt: Date;
};
