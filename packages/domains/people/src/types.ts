import type { UserId } from "@agds-hr/shared";

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

// A directory row. `rating` and `bandPosition` are review/comp outputs (later
// slices) — undefined until they land, rendered as pending in the UI.
export type DirectoryRow = {
  readonly userId: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly level: CareerLevel;
  readonly path: CareerPath;
  readonly country: string;
  readonly roleFamily: string;
  readonly rating: number | undefined;
  readonly bandPosition: number | undefined;
};
