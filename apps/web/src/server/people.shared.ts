import {
  APPEAL_CATEGORIES,
  CAREER_LEVEL_META,
  CAREER_LEVELS,
  CAREER_PATHS,
  EMPLOYMENT_TYPES,
  EVALUATION_DIMENSIONS,
  PEER_INPUT_KEYS,
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
  PeerInputKey,
  PeerKind,
  PeerRequestStatus,
  ReviewParticipationOverride,
  ReviewState,
} from "@agds-hr/people/types";
import { z } from "zod";

// Pure, client-importable shapes for the people server fns (§9.3). Enum tuples
// come from the client-safe @agds-hr/people/types subpath (no DB), so validators
// stay out of the server-only graph.
// No rating here: the directory is visible to all staff, and ratings are
// manager-graph-scoped (a person's rating is visible only to people who manage
// them, plus leadership) — so the directory payload must not carry them.
export type DirectoryEntry = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly functionalManagerName: string | undefined;
  readonly localManagerName: string | undefined;
  readonly active: boolean;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  // Undefined when no employee record exists (reads as the `employee` default).
  readonly employmentType: EmploymentType | undefined;
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

// Received reviews, one block per cycle (improve-ux plan). Visibility is
// manager-graph-scoped: the SUBJECT sees their self-review and the manager
// assessment of themselves but NEVER peer input; someone who manages the
// subject (either reporting line, any depth) and leadership see everything.
// `rating` follows the same rule — managers/leadership see it as soon as it
// exists, the subject only once the decision is delivered, nobody else ever.
// `peers: undefined` = not visible to this viewer; `[]` = visible, none yet.
export type ReceivedPeerView = {
  readonly requesteeEmail: string;
  readonly requesteeName: string | undefined;
  readonly kind: PeerKind;
  readonly submittedAt: string | undefined;
  readonly input: Readonly<Partial<Record<PeerInputKey, string>>>;
};

export type ReceivedCycleView = {
  readonly cycle: string;
  readonly state: ReviewState;
  readonly rating: number | undefined;
  readonly decidedAt: string | undefined;
  readonly self:
    | {
        readonly payload: Readonly<Partial<Record<SelfReviewKey, string>>>;
        readonly submittedAt: string | undefined;
      }
    | undefined;
  readonly peers: readonly ReceivedPeerView[] | undefined;
  readonly assessment: AssessmentView | undefined;
};

// Reviews this person GAVE. Content is per-item gated: visible when the viewer
// is the author themself, manages that item's subject, or is leadership — and
// never when the viewer IS that item's subject.
export type GivenAsManagerView = {
  readonly cycle: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly subjectUserId: string | undefined;
  readonly submittedAt: string | undefined;
  readonly proposedRating: number | undefined;
  readonly narrative: string | undefined;
};

export type GivenAsPeerView = {
  readonly cycle: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly subjectUserId: string | undefined;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly submittedAt: string | undefined;
  readonly input: Readonly<Partial<Record<PeerInputKey, string>>> | undefined;
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
  // Both reporting lines (improve-ux plan): the functional chain and the
  // direct local manager.
  readonly managers: readonly ManagerRef[];
  readonly localManager: ManagerRef | undefined;
  readonly reviewCase: ReviewCaseView | undefined;
  readonly canEditAttrs: boolean;
  readonly canReview: boolean;
  readonly canSign: boolean;
  readonly canViewComp: boolean;
  readonly canManageComp: boolean;
  readonly canImpersonate: boolean;
  readonly appeal: AppealView | undefined;
  readonly canAppeal: boolean;
  readonly isSubject: boolean;
  readonly managesSubject: boolean;
  readonly received: readonly ReceivedCycleView[];
  readonly givenAsManager: readonly GivenAsManagerView[];
  readonly givenAsPeer: readonly GivenAsPeerView[];
};

// The Salary bands surface (design): France-reference bands per role family &
// level, plus campus coefficients in basis points. Leadership-only to read;
// founders edit the figures in place.
export type BandsView = {
  readonly bands: readonly {
    readonly roleFamily: string;
    readonly level: CareerLevel;
    readonly minEur: number;
    readonly midEur: number;
    readonly maxEur: number;
  }[];
  readonly coefficients: readonly { readonly campus: string; readonly coefficientBp: number }[];
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
] as const;
export type SelfReviewKey = (typeof SELF_REVIEW_KEYS)[number];

// Header keys stamped from server-resolved context on save/submit — never
// collected from the subject (design-import artefact; the case + roster own
// name, role, manager, and cycle period).
export const SELF_REVIEW_STAMPED_KEYS = [
  "sr_name",
  "sr_role",
  "sr_manager",
  "sr_period",
] as const satisfies readonly SelfReviewKey[];

export type SelfReviewContext = {
  readonly name: string;
  readonly role: string;
  readonly manager: string;
  readonly period: string;
};

export type SelfReviewPayload = Readonly<Partial<Record<SelfReviewKey, string>>>;

// Role line for the self-review header: Inside title + agds-hr level/path.
export function formatSelfReviewRole(input: {
  readonly title: string | undefined;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
}): string {
  const parts: string[] = [];
  if (input.title !== undefined && input.title.trim().length > 0) {
    parts.push(input.title.trim());
  }
  if (input.level !== undefined) {
    parts.push(`${input.level} · ${CAREER_LEVEL_META[input.level].name}`);
  }
  if (input.path !== undefined) {
    parts.push(input.path === "ic" ? "IC" : "Management");
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

const stampedKeySet = new Set<string>(SELF_REVIEW_STAMPED_KEYS);

// Strip client-supplied header keys, then stamp server truth into the payload
// so the stored JSON carries a point-in-time snapshot without user drift.
export function stampSelfReviewHeader(
  payload: SelfReviewPayload,
  context: SelfReviewContext,
): Record<string, string> {
  const body = Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) => typeof value === "string" && !stampedKeySet.has(key),
    ),
  );
  return {
    ...body,
    sr_name: context.name,
    sr_role: context.role,
    sr_manager: context.manager,
    sr_period: context.period,
  };
}

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

// Ordered, labeled projection of a self-review payload for read surfaces
// (person record, assessment). Empty fields drop out.
export function selfReviewEntries(
  payload: Readonly<Partial<Record<SelfReviewKey, string>>>,
): readonly { readonly label: string; readonly value: string }[] {
  const entries: { label: string; value: string }[] = [];
  const push = (label: string, key: SelfReviewKey) => {
    const value = (payload[key] ?? "").trim();
    if (value !== "") {
      entries.push({ label, value });
    }
  };
  SELF_REVIEW_OBJECTIVE_ROWS.forEach((row, index) => {
    push(`Objective ${index + 1}`, row.obj);
    push(`Objective ${index + 1} · on target`, row.target);
    push(`Objective ${index + 1} · result`, row.result);
  });
  SELF_REVIEW_KPI_ROWS.forEach((row, index) => {
    push(`KPI ${index + 1}`, row.name);
    push(`KPI ${index + 1} · target`, row.target);
    push(`KPI ${index + 1} · actual`, row.actual);
    push(`KPI ${index + 1} · reading`, row.reading);
  });
  push("Context on the year", "c_context");
  push("Most proud of", "d_proud");
  push("Fell short", "d_short");
  push("Feedback received", "d_feedback");
  push("Made others effective", "d_others");
  push("Skills to build", "e_skills");
  push("Scope to take on", "e_scope");
  push("Role direction", "e_direction");
  push("Support needed", "e_support");
  push("Compensation fairness", "f_fair");
  return entries;
}

export type SelfReviewReadContext = {
  readonly name: string | undefined;
  readonly role: string | undefined;
  readonly manager: string | undefined;
  readonly period: string | undefined;
};

export type SelfReviewObjectiveRead = {
  readonly index: number;
  readonly title: string | undefined;
  readonly target: string | undefined;
  readonly result: string | undefined;
};

export type SelfReviewKpiRead = {
  readonly index: number;
  readonly name: string | undefined;
  readonly target: string | undefined;
  readonly actual: string | undefined;
  readonly reading: string | undefined;
};

export type SelfReviewFieldRead = {
  readonly label: string;
  readonly value: string;
};

export type SelfReviewReadModel = {
  readonly context: SelfReviewReadContext;
  readonly objectives: readonly SelfReviewObjectiveRead[];
  readonly kpis: readonly SelfReviewKpiRead[];
  readonly contextNote: string | undefined;
  readonly reflection: readonly SelfReviewFieldRead[];
  readonly development: readonly SelfReviewFieldRead[];
  readonly fairness: string | undefined;
};

const SELF_REVIEW_REFLECTION_READ: readonly {
  readonly key: SelfReviewKey;
  readonly label: string;
}[] = [
  { key: "d_proud", label: "Most proud of" },
  { key: "d_short", label: "Fell short" },
  { key: "d_feedback", label: "Feedback received" },
  { key: "d_others", label: "Made others effective" },
];

const SELF_REVIEW_DEVELOPMENT_READ: readonly {
  readonly key: SelfReviewKey;
  readonly label: string;
}[] = [
  { key: "e_skills", label: "Skills to build" },
  { key: "e_scope", label: "Scope to take on" },
  { key: "e_direction", label: "Role direction" },
  { key: "e_support", label: "Support needed" },
];

const readField = (
  payload: Readonly<Partial<Record<SelfReviewKey, string>>>,
  key: SelfReviewKey,
): string | undefined => {
  const value = (payload[key] ?? "").trim();
  return value === "" ? undefined : value;
};

// Structured projection for read surfaces — groups objectives/KPIs and mirrors
// the self-review form sections instead of a flat label list.
export function projectSelfReviewReadModel(
  payload: Readonly<Partial<Record<SelfReviewKey, string>>>,
): SelfReviewReadModel {
  const objectives = SELF_REVIEW_OBJECTIVE_ROWS.map((row, index) => ({
    index: index + 1,
    title: readField(payload, row.obj),
    target: readField(payload, row.target),
    result: readField(payload, row.result),
  })).filter(
    (row) => row.title !== undefined || row.target !== undefined || row.result !== undefined,
  );

  const kpis = SELF_REVIEW_KPI_ROWS.map((row, index) => ({
    index: index + 1,
    name: readField(payload, row.name),
    target: readField(payload, row.target),
    actual: readField(payload, row.actual),
    reading: readField(payload, row.reading),
  })).filter(
    (row) =>
      row.name !== undefined ||
      row.target !== undefined ||
      row.actual !== undefined ||
      row.reading !== undefined,
  );

  const reflection = SELF_REVIEW_REFLECTION_READ.flatMap((entry) => {
    const value = readField(payload, entry.key);
    return value === undefined ? [] : [{ label: entry.label, value }];
  });

  const development = SELF_REVIEW_DEVELOPMENT_READ.flatMap((entry) => {
    const value = readField(payload, entry.key);
    return value === undefined ? [] : [{ label: entry.label, value }];
  });

  return {
    context: {
      name: readField(payload, "sr_name"),
      role: readField(payload, "sr_role"),
      manager: readField(payload, "sr_manager"),
      period: readField(payload, "sr_period"),
    },
    objectives,
    kpis,
    contextNote: readField(payload, "c_context"),
    reflection,
    development,
    fairness: readField(payload, "f_fair"),
  };
}

export function selfReviewReadModelHasContent(model: SelfReviewReadModel): boolean {
  return (
    model.objectives.length > 0 ||
    model.kpis.length > 0 ||
    model.contextNote !== undefined ||
    model.reflection.length > 0 ||
    model.development.length > 0 ||
    model.fairness !== undefined
  );
}

export const selfReviewPayloadSchema = z.object({
  payload: z.partialRecord(z.enum(SELF_REVIEW_KEYS), z.string().max(4000)),
});
export type SelfReviewPayloadInput = z.infer<typeof selfReviewPayloadSchema>;

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
  readonly context: SelfReviewContext;
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
  input: z.partialRecord(z.enum(PEER_INPUT_KEYS), z.string().max(4000)),
});
export type PeerSubmitInput = z.infer<typeof peerSubmitSchema>;

export const peerDeclineSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

// Staff propose requestees for their OWN case (server resolves the case from
// the session; proposals await manager approval).
export const peerProposeSchema = z.object({
  requests: z
    .array(z.object({ email: z.string().email(), kind: z.enum(PEER_KINDS) }))
    .min(1)
    .max(20),
});
export type PeerProposeInput = z.infer<typeof peerProposeSchema>;

export const peerRequestIdSchema = z.object({ requestId: z.string().min(1) });

// The dedicated answer page (requestee-only).
export type PeerAnswerView = {
  readonly requestId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly subjectTitle: string | undefined;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly input: Readonly<Partial<Record<PeerInputKey, string>>>;
  readonly submittedAt: string | undefined;
};

export type PeerRequestView = {
  readonly id: string;
  readonly requesteeEmail: string;
  readonly requesteeName: string | undefined;
  readonly kind: PeerKind;
  readonly status: PeerRequestStatus;
  readonly declineReason: string | undefined;
  readonly submittedAt: string | undefined;
  readonly input: Readonly<Partial<Record<PeerInputKey, string>>>;
};

export type PeerCaseView = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly state: ReviewState;
  readonly quota: Readonly<Partial<Record<PeerKind, number>>>;
  readonly quotaMet: boolean;
  readonly requests: readonly PeerRequestView[];
  // The subject's local-team neighborhood (same local manager, their local
  // reports, their local manager) — used to auto-classify a picked colleague
  // as Own team vs Cross-team.
  readonly teamEmails: readonly string[];
  // Direct report of the viewer (either line, one hop) — indirect reports are
  // shown separately, since their peer setup is normally the direct manager's
  // call.
  readonly direct: boolean;
};

// The viewer's OWN case on the peer page (improve-ux plan): status only — a
// subject never sees peer-input content about themselves. `hasManagerSet` =
// the manager already created/approved live requests, so the propose form
// yields to a plain status list.
export type PeerApproverKind = "manager" | "co_founder";

export type MyPeerCaseView = {
  readonly caseId: string | undefined;
  readonly inReviewCycle: boolean;
  readonly canPropose: boolean;
  readonly hasManagerSet: boolean;
  // Who approves the subject's proposals: their manager, or a co-founder when
  // they have no reporting line in the identity graph.
  readonly approverKind: PeerApproverKind;
  readonly pendingProposals: number;
  readonly requests: readonly {
    readonly requesteeEmail: string;
    readonly requesteeName: string | undefined;
    readonly kind: PeerKind;
    readonly status: PeerRequestStatus;
  }[];
  // The viewer's own local-team neighborhood, for auto-classifying proposals.
  readonly teamEmails: readonly string[];
};

export type PeerPageView = {
  readonly requestsForYou: readonly {
    readonly id: string;
    readonly subjectEmail: string;
    readonly subjectName: string | undefined;
    readonly subjectTitle: string | undefined;
    readonly kind: PeerKind;
    readonly status: PeerRequestStatus;
    readonly declineReason: string | undefined;
    readonly submittedAt: string | undefined;
  }[];
  readonly isReviewer: boolean;
  readonly cases: readonly PeerCaseView[];
  readonly myCase: MyPeerCaseView;
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
  promoNote: z.string().max(1000),
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
  readonly promoNote: string;
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
  readonly direct: boolean;
  readonly selfReview: Readonly<Partial<Record<SelfReviewKey, string>>>;
  readonly selfReviewSubmittedAt: string | undefined;
  readonly peerSubmitted: number;
  readonly peerDeclined: number;
  readonly peers: readonly ReceivedPeerView[];
  readonly priorRating: number | undefined;
  readonly assessment: AssessmentView | undefined;
};

// One row per person the viewer manages (improve-ux plan): direct reports
// (either line) first, then indirect, each with review-readiness status. The
// assessment starts only when self-review is submitted and no peer request is
// still pending.
export type AssessReportRow = {
  readonly email: string;
  readonly name: string;
  readonly userId: string | undefined;
  readonly title: string | undefined;
  readonly direct: boolean;
  readonly inReviewCycle: boolean;
  readonly caseId: string | undefined;
  readonly state: ReviewState | undefined;
  readonly selfSubmitted: boolean;
  readonly peersPending: number;
  readonly peersSubmitted: number;
  readonly ready: boolean;
  readonly assessmentSubmitted: boolean;
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
  readonly promoNote: string;
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

// The Overview surface: reviewers get the scoped needs-a-decision list;
// everyone gets the cycle timeline and their own status. Org-wide distribution
// lives on /calibration.
export type OverviewData = {
  readonly cycle: string;
  readonly isReviewer: boolean;
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
  // The viewer's own open obligations — the "Your pending actions" block.
  readonly myPending: readonly PendingActionView[];
};

export type PendingActionView = {
  readonly kind: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly caseId: string;
  readonly openDays: number | undefined;
};

// The /tracking board: one row per case in the cycle, with completion flags
// per stage and the case's open obligations for the ageing column. Row scope
// (own reports vs everyone) is applied by the handler.
export type TrackingRow = {
  readonly caseId: string;
  readonly subjectEmail: string;
  readonly subjectName: string | undefined;
  readonly subjectUserId: string | undefined;
  readonly state: ReviewState;
  readonly decided: boolean;
  readonly selfSubmitted: boolean;
  readonly peersSubmitted: number;
  readonly peersPending: number;
  readonly quotaMet: boolean;
  readonly assessmentSubmitted: boolean;
  readonly signoffCount: number;
  readonly pending: readonly PendingActionView[];
};

export type TrackingView = {
  readonly cycle: string;
  readonly rows: readonly TrackingRow[];
  readonly counts: Readonly<Partial<Record<ReviewState, number>>>;
  readonly decidedCount: number;
};

// Sidebar affordances — minimal case snapshot for the authenticated frame.
export type NavHints = {
  readonly selfReviewAction: boolean;
  readonly peerInputAction: boolean;
};

export type PeerInputTab = "mine" | "give" | "team";

// Tab badge counts on /peer-input — shared with the frame nav hint so the
// sidebar dot stays in sync with in-page tabs.
export function peerTabBadges(input: {
  readonly requestsForYou: readonly { readonly status: PeerRequestStatus }[];
  readonly cases: readonly {
    readonly requests: readonly { readonly status: PeerRequestStatus }[];
  }[];
  readonly isReviewer: boolean;
}): Record<PeerInputTab, number> {
  const visibleForYou = input.requestsForYou.filter((request) => request.status !== "proposed");
  const pendingForYou = visibleForYou.filter((request) => request.status === "pending").length;
  const teamProposals = input.isReviewer
    ? input.cases.reduce(
        (sum, entry) =>
          sum + entry.requests.filter((request) => request.status === "proposed").length,
        0,
      )
    : 0;
  return { mine: 0, give: pendingForYou, team: teamProposals };
}

export function peerInputNavAction(input: Parameters<typeof peerTabBadges>[0]): boolean {
  const badges = peerTabBadges(input);
  return badges.give > 0 || badges.team > 0;
}

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
