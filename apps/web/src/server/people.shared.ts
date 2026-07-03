import {
  APPEAL_CATEGORIES,
  CAREER_LEVELS,
  CAREER_PATHS,
  REVIEW_STATES,
} from "@agds-hr/people/types";
import type { AppealCategory, CareerLevel, CareerPath, ReviewState } from "@agds-hr/people/types";
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
