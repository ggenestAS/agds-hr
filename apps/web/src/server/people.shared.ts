import {
  APPEAL_CATEGORIES,
  CAREER_LEVELS,
  CAREER_PATHS,
  EMPLOYMENT_TYPES,
  EVALUATION_DIMENSIONS,
  PEER_KINDS,
  REVIEW_PARTICIPATION_OVERRIDES,
  REVIEW_STATES,
} from "@agds-hr/people/types";
import type {
  AppealCategory,
  CareerLevel,
  CareerPath,
  EmploymentType,
  EvaluationDimension,
  PeerKind,
  PeerRequestStatus,
  ReviewParticipationOverride,
  ReviewState,
} from "@agds-hr/people/types";
import { z } from "zod";

// Pure, client-importable shapes for the people server fns (§9.3). Enum tuples
// come from the client-safe @agds-hr/people/types subpath (no DB), so validators
// stay out of the server-only graph.
export type DirectoryEntry = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly managerName: string | undefined;
  readonly active: boolean;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  // Undefined when no employee record exists (reads as the `employee` default).
  readonly employmentType: EmploymentType | undefined;
  readonly rating: number | undefined;
};

export const setEmployeeAttrsSchema = z.object({
  email: z.string().email(),
  level: z.enum(CAREER_LEVELS),
  path: z.enum(CAREER_PATHS),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  reviewParticipationOverride: z.enum(REVIEW_PARTICIPATION_OVERRIDES).nullable(),
});
export type SetEmployeeAttrsInput = z.infer<typeof setEmployeeAttrsSchema>;

export const advanceReviewSchema = z.object({
  caseId: z.string().min(1),
  toState: z.enum(REVIEW_STATES),
});

export const setRatingSchema = z.object({
  caseId: z.string().min(1),
  rating: z.number().int().min(1).max(4),
});

export const openReviewSchema = z.object({ email: z.string().email() });
export const signDecisionSchema = z.object({ caseId: z.string().min(1) });
export const compReadSchema = z.object({ caseId: z.string().min(1) });
export const setCompSchema = z.object({
  caseId: z.string().min(1),
  currentBaseEur: z.number().int().min(0),
  increaseEur: z.number().int().min(0),
  bonusEur: z.number().int().min(0),
  effectiveDate: z.string().optional(),
  rationale: z.string().optional(),
});
export type SetCompInput = z.infer<typeof setCompSchema>;

export const fileAppealSchema = z.object({
  caseId: z.string().min(1),
  category: z.enum(APPEAL_CATEGORIES),
  statement: z.string().min(1).max(4000),
});
export const resolveAppealSchema = z.object({
  appealId: z.string().min(1),
  resolution: z.string().min(1).max(4000),
});

// The Appeals surface (design M9): everyone sees their own appeal state and
// the submit form inside the window; HR Admins additionally see the queue.
export type AppealsPageView = {
  readonly canManage: boolean;
  readonly queue: readonly AppealView[];
  readonly myAppeal: AppealView | undefined;
  readonly myCaseId: string | undefined;
  readonly canAppealNow: boolean;
  readonly appealUntil: string | undefined;
};

export type AppealView = {
  readonly id: string;
  readonly caseId: string;
  readonly appellantEmail: string;
  readonly category: AppealCategory;
  readonly statement: string;
  readonly status: "open" | "resolved";
  readonly resolution: string | undefined;
  readonly createdAt: string;
};

// The compensation view — the recommendation (an audited read) plus, when the
// person has a band, their band position and the merit-matrix suggestion.
export type CompView = {
  readonly recommendation:
    | {
        readonly currentBaseEur: number;
        readonly increaseEur: number;
        readonly bonusEur: number;
        readonly newBaseEur: number;
        readonly effectiveDate: string | undefined;
        readonly rationale: string | undefined;
      }
    | undefined;
  readonly bandPositionPct: number | undefined;
  readonly meritSuggestionBp: number | undefined;
};

export type ReviewCaseView = {
  readonly id: string;
  readonly state: ReviewState;
  readonly rating: number | undefined;
  readonly nextStates: readonly ReviewState[];
  readonly signoffCount: number;
  readonly decidedAt: string | undefined;
  readonly appealUntil: string | undefined;
  readonly p6Triggered: boolean;
};

export type ManagerRef = {
  readonly userId: string;
  readonly name: string;
  readonly title: string | undefined;
};

export type PersonDetail = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly active: boolean;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  // Employment type + override drive the DERIVED band/review applicability;
  // `inReviewCycle` is the participatesInReview output (absent record =
  // `employee` defaults).
  readonly employmentType: EmploymentType;
  readonly reviewParticipationOverride: ReviewParticipationOverride | null;
  readonly inReviewCycle: boolean;
  readonly managers: readonly ManagerRef[];
  readonly reviewCase: ReviewCaseView | undefined;
  readonly canEditAttrs: boolean;
  readonly canReview: boolean;
  readonly canSign: boolean;
  readonly canViewComp: boolean;
  readonly canManageComp: boolean;
  readonly canImpersonate: boolean;
  readonly appeal: AppealView | undefined;
  readonly canAppeal: boolean;
  // The record tabs (design): the subject's self-review is visible to the
  // subject + reviewers; the manager assessment to reviewers only.
  readonly selfReview: Readonly<Partial<Record<SelfReviewKey, string>>> | undefined;
  readonly selfReviewSubmittedAt: string | undefined;
  readonly assessment: AssessmentView | undefined;
  readonly isSubject: boolean;
};

// The Salary bands surface (design): France-reference bands per role family &
// level, plus country coefficients in basis points. Leadership-only to read;
// founders edit the figures in place.
export type BandsView = {
  readonly bands: readonly {
    readonly roleFamily: string;
    readonly level: CareerLevel;
    readonly minEur: number;
    readonly midEur: number;
    readonly maxEur: number;
  }[];
  readonly coefficients: readonly { readonly country: string; readonly coefficientBp: number }[];
  readonly canManageBands: boolean;
};

export const setBandSchema = z
  .object({
    roleFamily: z.string().min(1).max(100),
    level: z.enum(CAREER_LEVELS),
    minEur: z.number().int().min(0).max(10_000_000),
    midEur: z.number().int().min(0).max(10_000_000),
    maxEur: z.number().int().min(0).max(10_000_000),
  })
  .refine((band) => band.minEur <= band.midEur && band.midEur <= band.maxEur, {
    message: "band range must satisfy min ≤ mid ≤ max",
  });
export type SetBandInput = z.infer<typeof setBandSchema>;

// The self-review form (design): sections A–F, all free text. A closed key set
// so the payload stays a validated string map rather than arbitrary JSON.
// Objectives and KPIs are dynamic rows over pre-allocated key slots: the form
// shows 2–6 objectives and 0–5 KPIs; unused slots simply stay empty.
export const SELF_REVIEW_OBJECTIVES_MIN = 2;
export const SELF_REVIEW_OBJECTIVES_MAX = 6;
export const SELF_REVIEW_KPIS_MIN = 0;
export const SELF_REVIEW_KPIS_MAX = 5;

export const SELF_REVIEW_KEYS = [
  "sr_name",
  "sr_role",
  "sr_manager",
  "sr_period",
  "o1_obj",
  "o1_target",
  "o1_result",
  "o2_obj",
  "o2_target",
  "o2_result",
  "o3_obj",
  "o3_target",
  "o3_result",
  "o4_obj",
  "o4_target",
  "o4_result",
  "o5_obj",
  "o5_target",
  "o5_result",
  "o6_obj",
  "o6_target",
  "o6_result",
  "k1_name",
  "k1_target",
  "k1_actual",
  "k1_reading",
  "k2_name",
  "k2_target",
  "k2_actual",
  "k2_reading",
  "k3_name",
  "k3_target",
  "k3_actual",
  "k3_reading",
  "k4_name",
  "k4_target",
  "k4_actual",
  "k4_reading",
  "k5_name",
  "k5_target",
  "k5_actual",
  "k5_reading",
  "c_context",
  "d_proud",
  "d_short",
  "d_feedback",
  "d_others",
  "e_skills",
  "e_scope",
  "e_direction",
  "e_support",
  "f_fair",
  // Suggested peer reviewers: the subject proposes, the manager decides
  // (selection authority stays with the reviewer; information comes from the
  // person with the most of it).
  "sr_peers",
] as const;
export type SelfReviewKey = (typeof SELF_REVIEW_KEYS)[number];

// Row-slot views over the flat key set, in display order.
export const SELF_REVIEW_OBJECTIVE_ROWS = [
  { obj: "o1_obj", target: "o1_target", result: "o1_result" },
  { obj: "o2_obj", target: "o2_target", result: "o2_result" },
  { obj: "o3_obj", target: "o3_target", result: "o3_result" },
  { obj: "o4_obj", target: "o4_target", result: "o4_result" },
  { obj: "o5_obj", target: "o5_target", result: "o5_result" },
  { obj: "o6_obj", target: "o6_target", result: "o6_result" },
] as const satisfies readonly {
  obj: SelfReviewKey;
  target: SelfReviewKey;
  result: SelfReviewKey;
}[];

export const SELF_REVIEW_KPI_ROWS = [
  { name: "k1_name", target: "k1_target", actual: "k1_actual", reading: "k1_reading" },
  { name: "k2_name", target: "k2_target", actual: "k2_actual", reading: "k2_reading" },
  { name: "k3_name", target: "k3_target", actual: "k3_actual", reading: "k3_reading" },
  { name: "k4_name", target: "k4_target", actual: "k4_actual", reading: "k4_reading" },
  { name: "k5_name", target: "k5_target", actual: "k5_actual", reading: "k5_reading" },
] as const satisfies readonly {
  name: SelfReviewKey;
  target: SelfReviewKey;
  actual: SelfReviewKey;
  reading: SelfReviewKey;
}[];

export const selfReviewPayloadSchema = z.object({
  payload: z.partialRecord(z.enum(SELF_REVIEW_KEYS), z.string().max(4000)),
});
export type SelfReviewPayloadInput = z.infer<typeof selfReviewPayloadSchema>;

export type SelfReviewPayload = Readonly<Partial<Record<SelfReviewKey, string>>>;

// Word-count guidance for the long-form fields (displayed live in the form and
// enforced at submit for FILLED fields). Bounds keep answers substantive
// without inviting padding: short inputs (names, targets, numbers) carry none.
export type WordBounds = { readonly min: number; readonly max: number };

const OBJECTIVE_RESULT_BOUNDS: WordBounds = { min: 20, max: 120 };
const KPI_READING_BOUNDS: WordBounds = { min: 15, max: 80 };

export const SELF_REVIEW_WORD_BOUNDS: Readonly<Partial<Record<SelfReviewKey, WordBounds>>> = {
  o1_result: OBJECTIVE_RESULT_BOUNDS,
  o2_result: OBJECTIVE_RESULT_BOUNDS,
  o3_result: OBJECTIVE_RESULT_BOUNDS,
  o4_result: OBJECTIVE_RESULT_BOUNDS,
  o5_result: OBJECTIVE_RESULT_BOUNDS,
  o6_result: OBJECTIVE_RESULT_BOUNDS,
  k1_reading: KPI_READING_BOUNDS,
  k2_reading: KPI_READING_BOUNDS,
  k3_reading: KPI_READING_BOUNDS,
  k4_reading: KPI_READING_BOUNDS,
  k5_reading: KPI_READING_BOUNDS,
  c_context: { min: 10, max: 120 },
  d_proud: { min: 30, max: 150 },
  d_short: { min: 30, max: 150 },
  d_feedback: { min: 20, max: 150 },
  d_others: { min: 20, max: 150 },
  e_skills: { min: 10, max: 80 },
  e_scope: { min: 10, max: 80 },
  e_direction: { min: 10, max: 80 },
  e_support: { min: 10, max: 80 },
  f_fair: { min: 20, max: 150 },
};

// Human names for the bounded fields, used in submit-gate issue messages.
const SELF_REVIEW_FIELD_NAMES: Readonly<Partial<Record<SelfReviewKey, string>>> = {
  o1_result: "Objective 1 · result",
  o2_result: "Objective 2 · result",
  o3_result: "Objective 3 · result",
  o4_result: "Objective 4 · result",
  o5_result: "Objective 5 · result",
  o6_result: "Objective 6 · result",
  k1_reading: "KPI 1 · reading",
  k2_reading: "KPI 2 · reading",
  k3_reading: "KPI 3 · reading",
  k4_reading: "KPI 4 · reading",
  k5_reading: "KPI 5 · reading",
  c_context: "Context on the year",
  d_proud: "Most proud of",
  d_short: "Where you fell short",
  d_feedback: "Feedback received",
  d_others: "Making others effective",
  e_skills: "Skills to build",
  e_scope: "Scope to take on",
  e_direction: "Role direction",
  e_support: "Support needed",
  f_fair: "Fairness concern",
};

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

const hasContent = (value: string | undefined): value is string =>
  value !== undefined && value.trim().length > 0;

// Highest 1-based row index carrying any content — how many rows the form
// must show to display an existing payload. 0 when the section is empty.
export function objectiveRowsInUse(payload: SelfReviewPayload): number {
  let used = 0;
  SELF_REVIEW_OBJECTIVE_ROWS.forEach((row, index) => {
    if ([payload[row.obj], payload[row.target], payload[row.result]].some(hasContent)) {
      used = index + 1;
    }
  });
  return used;
}

export function kpiRowsInUse(payload: SelfReviewPayload): number {
  let used = 0;
  SELF_REVIEW_KPI_ROWS.forEach((row, index) => {
    const values = [payload[row.name], payload[row.target], payload[row.actual]];
    if (values.some(hasContent) || hasContent(payload[row.reading])) {
      used = index + 1;
    }
  });
  return used;
}

// The submit gate, pure and shared: the form disables "Send to manager" on any
// issue, and the server re-checks before accepting a submit (fail closed —
// the client gate is a courtesy, the server gate is the rule). Draft saves are
// never gated: an incomplete draft is a normal state.
export function selfReviewSubmitIssues(payload: SelfReviewPayload): readonly string[] {
  const issues: string[] = [];

  let completeObjectives = 0;
  SELF_REVIEW_OBJECTIVE_ROWS.forEach((row, index) => {
    const parts = [payload[row.obj], payload[row.target], payload[row.result]];
    if (!parts.some(hasContent)) {
      return;
    }
    if (parts.every(hasContent)) {
      completeObjectives += 1;
    } else {
      issues.push(
        `Objective ${index + 1} is only partly filled — complete all three fields or clear it`,
      );
    }
  });
  if (completeObjectives < SELF_REVIEW_OBJECTIVES_MIN) {
    issues.push(
      `At least ${SELF_REVIEW_OBJECTIVES_MIN} complete objectives are required — ${completeObjectives} so far`,
    );
  }

  SELF_REVIEW_KPI_ROWS.forEach((row, index) => {
    const core = [payload[row.name], payload[row.target], payload[row.actual]];
    const touched = core.some(hasContent) || hasContent(payload[row.reading]);
    if (touched && !core.every(hasContent)) {
      issues.push(`KPI ${index + 1} needs a name, a target, and an actual — or clear it`);
    }
  });

  for (const key of SELF_REVIEW_KEYS) {
    const bounds = SELF_REVIEW_WORD_BOUNDS[key];
    const value = payload[key];
    if (bounds === undefined || !hasContent(value)) {
      continue;
    }
    const words = countWords(value);
    const name = SELF_REVIEW_FIELD_NAMES[key] ?? key;
    if (words < bounds.min) {
      issues.push(`${name}: ${words} ${words === 1 ? "word" : "words"} — aim for ${bounds.min}+`);
    } else if (words > bounds.max) {
      issues.push(`${name}: ${words} words — keep it under ${bounds.max}`);
    }
  }

  return issues;
}

export type SelfReviewView = {
  readonly caseId: string | undefined;
  readonly payload: Readonly<Partial<Record<SelfReviewKey, string>>>;
  readonly submittedAt: string | undefined;
  readonly managerName: string | undefined;
  readonly locked: boolean;
};

// Peer input (design M5): named input, never anonymous, never shown to the
// person being reviewed. Reviewers request; requestees submit or decline
// (declines logged with a reason).
export const peerRequestCreateSchema = z.object({
  caseId: z.string().min(1),
  requests: z
    .array(z.object({ email: z.string().email(), kind: z.enum(PEER_KINDS) }))
    .min(1)
    .max(20),
});
export type PeerRequestCreateInput = z.infer<typeof peerRequestCreateSchema>;

export const peerSubmitSchema = z.object({
  requestId: z.string().min(1),
  input: z.partialRecord(z.enum(EVALUATION_DIMENSIONS), z.string().max(4000)),
});
export type PeerSubmitInput = z.infer<typeof peerSubmitSchema>;

export const peerDeclineSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export type PeerRequestView = {
  readonly id: string;
  readonly requesteeEmail: string;
  readonly requesteeName: string | undefined;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly declineReason: string | undefined;
  readonly submittedAt: string | undefined;
  readonly input: Readonly<Partial<Record<EvaluationDimension, string>>>;
};

export type PeerCaseView = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly state: ReviewState;
  readonly quotaMet: boolean;
  readonly requests: readonly PeerRequestView[];
  // The subject's own suggestion from their self-review (sr_peers) — a hint
  // for the reviewer, who decides the final list.
  readonly peerSuggestions: string | undefined;
};

export type PeerPageView = {
  readonly requestsForYou: readonly {
    readonly id: string;
    readonly subjectEmail: string;
    readonly subjectName: string | undefined;
    readonly kind: PeerKind;
    readonly status: PeerRequestStatus;
    readonly declineReason: string | undefined;
  }[];
  readonly isReviewer: boolean;
  readonly cases: readonly PeerCaseView[];
  readonly directory: readonly {
    readonly email: string;
    readonly name: string;
    readonly title: string | undefined;
  }[];
};

// The manager assessment (design M6): evidence-based, per-dimension.
const assessmentDimSchema = z.object({
  score: z.number().int().min(1).max(4),
  narrative: z.string().max(4000),
  evidence: z.string().max(4000),
});

export const assessmentSaveSchema = z.object({
  caseId: z.string().min(1),
  dims: z.partialRecord(z.enum(EVALUATION_DIMENSIONS), assessmentDimSchema),
  narrative: z.string().max(8000),
  proposedRating: z.number().int().min(1).max(4).optional(),
  promoProposed: z.boolean(),
  compRec: z.string().max(200),
  p6Acknowledged: z.boolean(),
});
export type AssessmentSaveInput = z.infer<typeof assessmentSaveSchema>;

export type AssessmentView = {
  readonly dims: Readonly<
    Partial<
      Record<
        EvaluationDimension,
        { readonly score: number; readonly narrative: string; readonly evidence: string }
      >
    >
  >;
  readonly narrative: string;
  readonly proposedRating: number | undefined;
  readonly promoProposed: boolean;
  readonly compRec: string;
  readonly p6Acknowledged: boolean;
  readonly submittedAt: string | undefined;
};

export type AssessCaseDetail = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly state: ReviewState;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  readonly selfReview: Readonly<Partial<Record<SelfReviewKey, string>>>;
  readonly selfReviewSubmittedAt: string | undefined;
  readonly peerSubmitted: number;
  readonly peerDeclined: number;
  readonly priorRating: number | undefined;
  readonly assessment: AssessmentView | undefined;
};

export type AssessCaseSummary = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly state: ReviewState;
};

// Decision & sign-off (design M8): both founders must sign — two distinct,
// authenticated confirmations — before the decision summary is delivered.
export type SignQueueEntry = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  readonly state: ReviewState;
  readonly rating: number | undefined;
  readonly signoffs: readonly string[];
  readonly signedByMe: boolean;
  readonly decidedAt: string | undefined;
  readonly appealUntil: string | undefined;
  readonly p6Triggered: boolean;
  readonly compRecType: string;
  readonly promoProposed: boolean;
  readonly rationale: string;
};

export type SignPageView = {
  readonly canSign: boolean;
  readonly canViewComp: boolean;
  readonly queue: readonly SignQueueEntry[];
};

// The Audit log surface (design P9): append-only trail, leadership-read-only.
export type AuditLogRow = {
  readonly id: string;
  readonly when: string;
  readonly actor: string;
  readonly subject: string;
  readonly eventType: string;
  readonly resourceId: string | undefined;
  readonly category: "Read" | "Sign-off" | "Write";
};

// The Documentation surface (design): every delivered decision, documented —
// rating, amounts, rationale. Reading this page is itself an audited comp read.
export type DecisionDoc = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly name: string | undefined;
  readonly userId: string | undefined;
  readonly rating: number | undefined;
  readonly decidedAt: string;
  readonly tag: "Promotion-scale raise" | "Bonus" | "Merit" | "No raise" | "Undocumented";
  readonly amount: string;
  readonly rationale: string | undefined;
  readonly effectiveDate: string | undefined;
};

// The Overview surface (design): stat tiles + rating distribution + attention
// list for reviewers; everyone gets the cycle timeline and their own status.
export type OverviewData = {
  readonly cycle: string;
  readonly isReviewer: boolean;
  readonly stats: readonly {
    readonly label: string;
    readonly value: string;
    readonly sub: string;
  }[];
  readonly distribution: Readonly<Record<1 | 2 | 3 | 4, number>>;
  readonly needsDecision: readonly {
    readonly subjectEmail: string;
    readonly name: string | undefined;
    readonly userId: string | undefined;
    readonly rating: number | undefined;
  }[];
  readonly myCase:
    | {
        readonly state: ReviewState;
        readonly decidedAt: string | undefined;
        readonly appealUntil: string | undefined;
      }
    | undefined;
};

export type CalibrationPerson = {
  readonly subjectEmail: string;
  readonly name: string | undefined;
  readonly userId: string | undefined;
  readonly title: string | undefined;
  readonly state: ReviewState;
  readonly rating: number | undefined;
};

export type CalibrationSummary = {
  readonly cycle: string;
  readonly distribution: Readonly<Record<1 | 2 | 3 | 4, number>>;
  readonly total: number;
  readonly unrated: number;
  readonly needsDecision: readonly {
    readonly subjectEmail: string;
    readonly rating: number | undefined;
  }[];
  // Compare people at the same level and similar scope (design): cases grouped
  // by assigned level, unassigned last.
  readonly groups: readonly {
    readonly level: CareerLevel | undefined;
    readonly people: readonly CalibrationPerson[];
  }[];
};
