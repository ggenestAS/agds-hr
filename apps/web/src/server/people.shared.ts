import { CAREER_LEVELS, CAREER_PATHS, REVIEW_STATES } from "@agds-hr/people/types";
import type { CareerLevel, CareerPath, ReviewState } from "@agds-hr/people/types";
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
