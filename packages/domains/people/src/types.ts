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
};
