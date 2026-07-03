import {
  APPEAL_CATEGORIES,
  CAREER_LEVELS,
  CAREER_PATHS,
  EVALUATION_DIMENSIONS,
  PEER_KINDS,
  REVIEW_STATES,
} from "@agds-hr/people/types";
import type {
  AppealCategory,
  CareerLevel,
  CareerPath,
  EvaluationDimension,
  PeerKind,
  PeerRequestStatus,
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
  readonly rating: number | undefined;
};

export const setEmployeeAttrsSchema = z.object({
  email: z.string().email(),
  level: z.enum(CAREER_LEVELS),
  path: z.enum(CAREER_PATHS),
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
  readonly managers: readonly ManagerRef[];
  readonly reviewCase: ReviewCaseView | undefined;
  readonly canEditAttrs: boolean;
  readonly canReview: boolean;
  readonly canSign: boolean;
  readonly canViewComp: boolean;
  readonly canManageComp: boolean;
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
// level, plus country coefficients in basis points. Leadership-only.
export type BandsView = {
  readonly bands: readonly {
    readonly roleFamily: string;
    readonly level: CareerLevel;
    readonly minEur: number;
    readonly midEur: number;
    readonly maxEur: number;
  }[];
  readonly coefficients: readonly { readonly country: string; readonly coefficientBp: number }[];
};

// The self-review form (design): sections A–F, all free text. A closed key set
// so the payload stays a validated string map rather than arbitrary JSON.
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
  "k1_name",
  "k1_target",
  "k1_actual",
  "k1_reading",
  "k2_name",
  "k2_target",
  "k2_actual",
  "k2_reading",
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
] as const;
export type SelfReviewKey = (typeof SELF_REVIEW_KEYS)[number];

export const selfReviewPayloadSchema = z.object({
  payload: z.partialRecord(z.enum(SELF_REVIEW_KEYS), z.string().max(4000)),
});
export type SelfReviewPayloadInput = z.infer<typeof selfReviewPayloadSchema>;

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

export type CalibrationSummary = {
  readonly cycle: string;
  readonly distribution: Readonly<Record<1 | 2 | 3 | 4, number>>;
  readonly total: number;
  readonly unrated: number;
  readonly needsDecision: readonly {
    readonly subjectEmail: string;
    readonly rating: number | undefined;
  }[];
};
