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

export type ReviewCaseView = {
  readonly id: string;
  readonly state: ReviewState;
  readonly rating: number | undefined;
  readonly nextStates: readonly ReviewState[];
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
  readonly canManage: boolean;
};
