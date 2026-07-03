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

// Employment types (2026-07-03-employment-types-and-review-participation.md).
// A closed set: the contract forms Albert actually hires under. `employee` is
// salaried CDI/CDD — the default, and the only band-governed type.
export const EMPLOYMENT_TYPES = ["employee", "apprentice", "vie", "intern", "freelance"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const isEmploymentType = (value: string): value is EmploymentType =>
  (EMPLOYMENT_TYPES as readonly string[]).includes(value);

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  employee: "Employee (CDI/CDD)",
  apprentice: "Apprentice",
  vie: "VIE",
  intern: "Intern",
  freelance: "Freelance",
};

// Per-person review-participation override. `null` (no override) follows the
// type default. Named after the policy it controls, not a population: today the
// convention is that it is only set for freelancers, but the mechanism is
// population-agnostic (ADR).
export const REVIEW_PARTICIPATION_OVERRIDES = ["included", "excluded"] as const;
export type ReviewParticipationOverride = (typeof REVIEW_PARTICIPATION_OVERRIDES)[number];
export const isReviewParticipationOverride = (
  value: string,
): value is ReviewParticipationOverride =>
  (REVIEW_PARTICIPATION_OVERRIDES as readonly string[]).includes(value);

// Derived policy, not a stored column (it cannot drift from the type): only
// salaried employees are band-governed. Apprentices, VIE, interns, and
// freelancers sit outside the bands (freelancers invoice day rates).
export function isSalaryBandApplicable(type: EmploymentType): boolean {
  return type === "employee";
}

// Review-cycle participation: employees by default; everyone else is opt-in
// via the explicit override. Fail closed — a wrongly-skipped review is visible
// and recoverable; non-participants polluting managers' review queues erode
// trust in the cycle (ADR).
export function participatesInReview(
  type: EmploymentType,
  override: ReviewParticipationOverride | null,
): boolean {
  if (override !== null) {
    return override === "included";
  }
  return type === "employee";
}

// Display metadata from the imported design: each level's name and its one-line
// "test" question, and the four rating labels. Pure presentation — the codes
// (L1..L4, ratings 1..4) stay the stored values.
export const CAREER_LEVEL_META: Record<CareerLevel, { name: string; test: string }> = {
  L1: { name: "Contributor", test: "Can deliver well with guidance?" },
  L2: { name: "Owner", test: "Can be trusted end-to-end?" },
  L3: { name: "Lead", test: "Improves the system, not just tasks?" },
  L4: { name: "Head / Principal", test: "Builds capability that lets Albert scale?" },
};

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

// Rating display labels from the design (4 Exceptional … 1 Not at level).
export const REVIEW_RATING_LABELS: Record<ReviewRating, string> = {
  4: "Exceptional",
  3: "Strong",
  2: "Inconsistent",
  1: "Not at level",
};

// The single active review cycle. The optimized 2026 shape: mid-year check-in
// Jan–Feb; budget planning in June (comp budget, promotion envelope, bonus
// pool, headcount — BEFORE reviews begin); self-review & peer input late June;
// manager review preparation early July; calibration early July (before any
// outcome is communicated); annual review & objective setting July–August;
// effective September.
export const REVIEW_CURRENT_CYCLE = "2026";
// Human-readable window for the active cycle — stamped on self-reviews from
// server truth, never collected from the subject (cyclePeriod is the code).
// The reviewed period runs July -> June (annual review lands July-August, for
// the year just closed each June).
export const REVIEW_CYCLE_PERIOD_LABEL = "Jul 2025 – Jun 2026";

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

// --- Review inputs (self-review, peer input, assessment) --------------------
// The five shared evaluation dimensions (design), rated 1–4 against level.
export const EVALUATION_DIMENSIONS = [
  "impact",
  "ownership",
  "quality",
  "collaboration",
  "culture",
] as const;
export type EvaluationDimension = (typeof EVALUATION_DIMENSIONS)[number];
export const EVALUATION_DIMENSION_LABELS: Record<EvaluationDimension, string> = {
  impact: "Impact",
  ownership: "Ownership",
  quality: "Quality & rigor",
  collaboration: "Collaboration",
  culture: "Culture & judgment",
};

// Peer input is NAMED — never anonymous, never shown to the person being
// reviewed (design M5). Requestees are LT peers, own-team, or cross-team.
export const PEER_KINDS = ["lt", "team", "cross"] as const;
export type PeerKind = (typeof PEER_KINDS)[number];

// `proposed` = suggested by the SUBJECT for their own case, awaiting the
// manager's approval (improve-ux plan: staff request peer inputs, reviewed by
// the manager). Approval flips it to `pending`, which notifies the requestee.
// Appended last to match pg's ALTER TYPE ADD VALUE ordering.
export const PEER_REQUEST_STATUSES = ["pending", "submitted", "declined", "proposed"] as const;
export type PeerRequestStatus = (typeof PEER_REQUEST_STATUSES)[number];

// The peer-input gate (design M5): 2 cross-team submissions always; own-team
// submissions scale with local team size (2 when ≥2 local peers, 1 when 1, 0
// when solo). Enforced at the case level by the advance handler.
export const PEER_CROSS_QUOTA = 2;

export function ownTeamPeerQuota(localTeamPeerCount: number): number {
  return Math.min(2, Math.max(0, localTeamPeerCount));
}

export function peerInputQuota(
  localTeamPeerCount: number,
): Readonly<Partial<Record<PeerKind, number>>> {
  const team = ownTeamPeerQuota(localTeamPeerCount);
  return team > 0 ? { cross: PEER_CROSS_QUOTA, team } : { cross: PEER_CROSS_QUOTA };
}

export function isPeerQuotaMet(
  requests: readonly { readonly kind: PeerKind; readonly status: PeerRequestStatus }[],
  quota: Readonly<Partial<Record<PeerKind, number>>>,
): boolean {
  return Object.entries(quota).every(([kind, needed]) => {
    const submitted = requests.filter(
      (request) => request.kind === kind && request.status === "submitted",
    ).length;
    return submitted >= needed;
  });
}

export type PeerRequest = {
  readonly id: string;
  readonly caseId: string;
  readonly requesteeEmail: string;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly declineReason: string | undefined;
  readonly input: Readonly<Partial<Record<EvaluationDimension, string>>>;
  readonly submittedAt: Date | undefined;
  readonly createdAt: Date;
};

export type SelfReview = {
  readonly caseId: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly submittedAt: Date | undefined;
};

// The manager assessment (design M6): per-dimension score + narrative +
// evidence, an overall narrative, the proposed rating, and the comp
// recommendation TYPE (amounts are set by Admins at sign-off).
export type AssessmentDimension = {
  readonly score: ReviewRating;
  readonly narrative: string;
  readonly evidence: string;
};

export type Assessment = {
  readonly caseId: string;
  readonly dims: Readonly<Partial<Record<EvaluationDimension, AssessmentDimension>>>;
  readonly narrative: string;
  readonly proposedRating: ReviewRating | undefined;
  readonly promoProposed: boolean;
  readonly compRec: string;
  readonly p6Acknowledged: boolean;
  readonly authorEmail: string | undefined;
  readonly submittedAt: Date | undefined;
};

// An assessment may only be submitted when every dimension has a score, a
// narrative, and at least one piece of evidence — and a low proposed rating
// (P6 trigger) has been explicitly acknowledged (design: "Assessments must be
// evidence-based; vague impressions are not sufficient").
export function canSubmitAssessment(input: {
  readonly dims: Readonly<Partial<Record<EvaluationDimension, AssessmentDimension>>>;
  readonly proposedRating: ReviewRating | undefined;
  readonly p6Acknowledged: boolean;
}): boolean {
  const complete = EVALUATION_DIMENSIONS.every((dimension) => {
    const entry = input.dims[dimension];
    return (
      entry !== undefined && entry.narrative.trim().length > 0 && entry.evidence.trim().length > 0
    );
  });
  if (!complete || input.proposedRating === undefined) {
    return false;
  }
  return isP6Triggered(input.proposedRating) ? input.p6Acknowledged : true;
}

// --- Appeals ---------------------------------------------------------------
// What is being appealed (design: Rating / Raise / Band placement / Exception).
export const APPEAL_CATEGORIES = ["rating", "raise", "band", "exception"] as const;
export type AppealCategory = (typeof APPEAL_CATEGORIES)[number];
export const isAppealCategory = (value: string): value is AppealCategory =>
  (APPEAL_CATEGORIES as readonly string[]).includes(value);

export const APPEAL_STATUSES = ["open", "resolved"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

// Who may SEE a filed appeal (statement/category/resolution): HR Admins and the
// appellant only (design) — never an arbitrary directory viewer.
export function canSeeAppeal(input: {
  readonly isSubject: boolean;
  readonly canManageAppeals: boolean;
}): boolean {
  return input.isSubject || input.canManageAppeals;
}

// Whether the subject may still FILE an appeal: they are the appellant, the
// decision was delivered (window open), the 30-day clock has not elapsed, and no
// appeal exists yet. `nowMs`/`appealUntilMs` are passed in to keep this pure.
export function canFileAppealNow(input: {
  readonly isSubject: boolean;
  readonly appealUntilMs: number | undefined;
  readonly nowMs: number;
  readonly alreadyFiled: boolean;
}): boolean {
  return (
    input.isSubject &&
    !input.alreadyFiled &&
    input.appealUntilMs !== undefined &&
    input.appealUntilMs >= input.nowMs
  );
}

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
