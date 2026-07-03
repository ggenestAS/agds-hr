import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  APPEAL_CATEGORIES,
  CAREER_LEVELS,
  CAREER_LEVEL_META,
  CAREER_PATHS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EVALUATION_DIMENSIONS,
  EVALUATION_DIMENSION_LABELS,
  REVIEW_PARTICIPATION_OVERRIDES,
  REVIEW_RATING_LABELS,
  isReviewRating,
  isSalaryBandApplicable,
} from "@agds-hr/people/types";
import type {
  AppealCategory,
  CareerLevel,
  CareerPath,
  EmploymentType,
  ReviewParticipationOverride,
  ReviewState,
} from "@agds-hr/people/types";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import type { CompView, PersonDetail } from "../server/people.shared.ts";
import {
  advanceReviewFn,
  compFn,
  fileAppealFn,
  openReviewFn,
  personDetailFn,
  setEmployeeAttrsFn,
  setRatingFn,
  signDecisionFn,
} from "../server/people.functions.ts";
import { impersonateStartFn } from "../server/impersonation.functions.ts";

// The employee record (design): dark hero + tabs — Evaluation (job
// architecture, assessed dimensions), Review (state machine controls,
// self-review, manager assessment, appeal), Compensation (audited reveal),
// History (record & decision timeline).
export const Route = createFileRoute("/_app/people/$userId")({
  loader: ({ params }) => personDetailFn({ data: params.userId }),
  component: PersonDetailPage,
});

const PATH_LABEL: Record<CareerPath, string> = { ic: "IC path", manager: "Management path" };
const STATE_LABEL: Record<ReviewState, string> = {
  self_review: "Self-review",
  peer_input: "Peer input",
  manager_assessment: "Manager assessment",
  calibration: "Calibration",
  decision: "Decision",
  appeal: "Appeal",
  closed: "Closed",
};
const APPEAL_CATEGORY_LABEL: Record<AppealCategory, string> = {
  rating: "Rating",
  raise: "Raise",
  band: "Band",
  exception: "Other",
};

const TABS = ["Evaluation", "Review", "Compensation", "History"] as const;
type Tab = (typeof TABS)[number];

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const ratingChip = (rating: number | undefined, large = false) =>
  rating !== undefined && isReviewRating(rating) ? (
    <span
      className={`rounded-full font-bold ${
        rating >= 3 ? "bg-white/15 text-white" : "bg-coral text-[#5a2018]"
      } ${large ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]"}`}
    >
      {REVIEW_RATING_LABELS[rating]}
    </span>
  ) : null;

function PersonDetailPage() {
  const person: PersonDetail = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Evaluation");
  const [level, setLevel] = useState<CareerLevel>(person.level ?? "L1");
  const [path, setPath] = useState<CareerPath>(person.path ?? "ic");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(person.employmentType);
  const [reviewOverride, setReviewOverride] = useState<ReviewParticipationOverride | null>(
    person.reviewParticipationOverride,
  );
  const [busy, setBusy] = useState(false);
  const [comp, setComp] = useState<CompView | null>(null);
  const [appealCategory, setAppealCategory] = useState<AppealCategory>("rating");
  const [appealStatement, setAppealStatement] = useState("");

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const visibleTabs = TABS.filter((entry) => entry !== "Compensation" || person.canViewComp);
  const reviewCase = person.reviewCase;
  const selfEntries: readonly { label: string; value: string }[] =
    person.selfReview === undefined
      ? []
      : [
          { label: "Objective 1 · result", value: person.selfReview.o1_result ?? "" },
          { label: "Objective 2 · result", value: person.selfReview.o2_result ?? "" },
          { label: "Objective 3 · result", value: person.selfReview.o3_result ?? "" },
          { label: "Objective 4 · result", value: person.selfReview.o4_result ?? "" },
          { label: "Objective 5 · result", value: person.selfReview.o5_result ?? "" },
          { label: "Objective 6 · result", value: person.selfReview.o6_result ?? "" },
          { label: "Most proud of", value: person.selfReview.d_proud ?? "" },
          { label: "Fell short", value: person.selfReview.d_short ?? "" },
          { label: "Feedback received", value: person.selfReview.d_feedback ?? "" },
          { label: "Support needed", value: person.selfReview.e_support ?? "" },
        ].filter((entry) => entry.value !== "");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link to="/people" className="text-sm text-muted-foreground hover:text-foreground">
        ← All people
      </Link>

      {/* record hero */}
      <div className="mt-4 flex items-center gap-6 rounded-[20px] bg-ink-900 p-7 text-white">
        <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] font-display text-2xl font-bold">
          {initials(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
              {person.name}
            </h1>
            {ratingChip(reviewCase?.rating, true)}
            {!person.active && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
                Inactive
              </span>
            )}
          </div>
          {person.title !== undefined && (
            <p className="mt-1 text-sm text-white/80">{person.title}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/60">
            <span>
              {person.level !== undefined
                ? `${person.level} · ${CAREER_LEVEL_META[person.level].name}${person.path !== undefined ? ` · ${PATH_LABEL[person.path]}` : ""}`
                : "Level unassigned"}
            </span>
            {person.employmentType !== "employee" && (
              <span>
                {EMPLOYMENT_TYPE_LABELS[person.employmentType]}
                {!person.inReviewCycle && " · outside the review cycle"}
                {!isSalaryBandApplicable(person.employmentType) && " · outside salary bands"}
              </span>
            )}
            {person.country !== undefined && <span>{person.country}</span>}
            {person.managers[0] !== undefined && <span>Reports to {person.managers[0].name}</span>}
            {person.campus !== undefined && <span>{person.campus}</span>}
          </div>
        </div>
        {person.canImpersonate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void impersonateStartFn({ data: { email: person.email } })
                .then(() => {
                  // Full navigation: the whole app must re-resolve the session
                  // as the impersonated subject.
                  window.location.assign("/dashboard");
                })
                .catch(() => setBusy(false));
            }}
            className="shrink-0 self-start rounded-full border border-white/25 px-4 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10"
            title="See the product exactly as this person sees it — recorded in the audit trail"
          >
            View as {person.name.split(" ")[0]} →
          </button>
        )}
      </div>

      {/* tabs */}
      <div className="mb-6 mt-5 flex gap-6 border-b border-border">
        {visibleTabs.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setTab(entry)}
            className={
              entry === tab
                ? "-mb-px border-b-2 border-[var(--color-accent)] pb-3 text-sm font-semibold"
                : "-mb-px border-b-2 border-transparent pb-3 text-sm font-semibold text-ink-300 hover:text-ink-500"
            }
          >
            {entry}
          </button>
        ))}
      </div>

      {tab === "Evaluation" && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.35fr]">
          <Card>
            <CardHeader>
              <CardTitle>Job architecture</CardTitle>
              <p className="text-sm text-muted-foreground">
                Four levels · two paths. Neither path is superior.
              </p>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {CAREER_LEVELS.map((entry) => {
                const meta = CAREER_LEVEL_META[entry];
                const active = entry === person.level;
                return (
                  <div
                    key={entry}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-xl border border-ink-900 bg-cream px-3.5 py-2.5"
                        : "flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-2.5"
                    }
                  >
                    <span
                      className={
                        active
                          ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-white"
                          : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-bone text-xs font-bold text-ink-300"
                      }
                    >
                      {entry}
                    </span>
                    <span>
                      <span
                        className={
                          active
                            ? "block text-[13.5px] font-bold"
                            : "block text-[13.5px] font-bold text-ink-500"
                        }
                      >
                        {meta.name}
                      </span>
                      <span className="block font-serif text-[13px] italic text-muted-foreground">
                        {meta.test}
                      </span>
                    </span>
                  </div>
                );
              })}

              {person.canEditAttrs && (
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                  <label className="text-xs">
                    Level
                    <select
                      value={level}
                      onChange={(event) => setLevel(event.target.value as CareerLevel)}
                      className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                    >
                      {CAREER_LEVELS.map((value) => (
                        <option key={value} value={value}>
                          {value} · {CAREER_LEVEL_META[value].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Path
                    <select
                      value={path}
                      onChange={(event) => setPath(event.target.value as CareerPath)}
                      className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                    >
                      {CAREER_PATHS.map((value) => (
                        <option key={value} value={value}>
                          {PATH_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Employment
                    <select
                      value={employmentType}
                      onChange={(event) => setEmploymentType(event.target.value as EmploymentType)}
                      className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                    >
                      {EMPLOYMENT_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {EMPLOYMENT_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Review participation
                    <select
                      value={reviewOverride ?? ""}
                      onChange={(event) =>
                        setReviewOverride(
                          event.target.value === ""
                            ? null
                            : (event.target.value as ReviewParticipationOverride),
                        )
                      }
                      className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                    >
                      <option value="">Type default</option>
                      {REVIEW_PARTICIPATION_OVERRIDES.map((value) => (
                        <option key={value} value={value}>
                          {value === "included" ? "Included" : "Excluded"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void run(() =>
                        setEmployeeAttrsFn({
                          data: {
                            email: person.email,
                            level,
                            path,
                            employmentType,
                            reviewParticipationOverride: reviewOverride,
                          },
                        }),
                      );
                    }}
                  >
                    Save
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between">
                  <CardTitle>Evaluation dimensions</CardTitle>
                  <span className="text-xs text-muted-foreground">Rated 1–4 against level</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                {person.assessment === undefined ? (
                  <p className="text-muted-foreground">
                    The five shared dimensions are scored in the manager assessment — nothing on
                    record yet
                    {!person.canReview && " (visible to reviewers once assessed)"}.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {EVALUATION_DIMENSIONS.map((dimension) => {
                      const entry = person.assessment?.dims[dimension];
                      return (
                        <div key={dimension}>
                          <div className="mb-1.5 flex items-baseline justify-between">
                            <span className="text-sm font-semibold">
                              {EVALUATION_DIMENSION_LABELS[dimension]}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                              {entry !== undefined && isReviewRating(entry.score)
                                ? `${entry.score} · ${REVIEW_RATING_LABELS[entry.score]}`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map((pip) => (
                              <span
                                key={pip}
                                className={
                                  entry !== undefined && pip <= entry.score
                                    ? "h-1.5 flex-1 rounded-sm bg-ink-900"
                                    : "h-1.5 flex-1 rounded-sm bg-bone"
                                }
                              />
                            ))}
                          </div>
                          {entry !== undefined && entry.narrative !== "" && (
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                              {entry.narrative}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reports to</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {person.managers.length === 0 ? (
                  <span className="text-muted-foreground">No manager on record.</span>
                ) : (
                  <ol className="space-y-1">
                    {person.managers.map((manager, index) => (
                      <li key={manager.userId} className="flex items-baseline gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {index + 1}.
                        </span>
                        <Link
                          to="/people/$userId"
                          params={{ userId: manager.userId }}
                          className="font-medium hover:text-[var(--color-accent)]"
                        >
                          {manager.name}
                        </Link>
                        {manager.title !== undefined && (
                          <span className="text-xs text-muted-foreground">{manager.title}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "Review" && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Annual review · 2026</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {reviewCase === undefined ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {person.inReviewCycle
                      ? "No review case for this cycle."
                      : `Not in the review cycle — ${EMPLOYMENT_TYPE_LABELS[person.employmentType]}${
                          person.reviewParticipationOverride === "excluded"
                            ? ", explicitly excluded"
                            : ""
                        }. Opt in via the review-participation flag.`}
                  </span>
                  {person.canReview && person.inReviewCycle && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        void run(() => openReviewFn({ data: { email: person.email } }));
                      }}
                    >
                      Open review case
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
                      {STATE_LABEL[reviewCase.state]}
                    </span>
                    <span className="text-muted-foreground">
                      Rating:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {reviewCase.rating ?? "—"}
                      </span>
                    </span>
                    {reviewCase.p6Triggered && (
                      <span className="rounded-full bg-[var(--color-warning-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]">
                        P6 improvement plan
                      </span>
                    )}
                  </div>

                  {reviewCase.decidedAt !== undefined ? (
                    <div className="rounded-[10px] bg-cream px-3 py-2 text-sm">
                      Decision delivered {new Date(reviewCase.decidedAt).toLocaleDateString()} ·
                      appeal window until{" "}
                      <span className="font-semibold">
                        {reviewCase.appealUntil === undefined
                          ? "—"
                          : new Date(reviewCase.appealUntil).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    reviewCase.state === "decision" && (
                      <div className="flex items-center gap-3 border-t border-border pt-3 text-sm">
                        <span className="text-muted-foreground">
                          Founder sign-offs:{" "}
                          <span className="font-semibold tabular-nums text-foreground">
                            {reviewCase.signoffCount}/2
                          </span>{" "}
                          — both founders must sign to deliver.
                        </span>
                        {person.canSign && (
                          <Button
                            type="button"
                            size="sm"
                            className="ml-auto"
                            disabled={busy}
                            onClick={() => {
                              const caseId = reviewCase.id;
                              void run(() => signDecisionFn({ data: { caseId } }));
                            }}
                          >
                            Sign decision
                          </Button>
                        )}
                      </div>
                    )
                  )}
                  {person.canReview && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {reviewCase.nextStates.map((next) => (
                        <Button
                          key={next}
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            const caseId = reviewCase.id;
                            void run(() => advanceReviewFn({ data: { caseId, toState: next } }));
                          }}
                        >
                          → {STATE_LABEL[next]}
                        </Button>
                      ))}
                      <label className="ml-auto text-xs text-muted-foreground">
                        Set rating
                        <select
                          defaultValue=""
                          disabled={busy}
                          onChange={(event) => {
                            const caseId = reviewCase.id;
                            const value = Number(event.target.value);
                            if (value >= 1 && value <= 4) {
                              void run(() => setRatingFn({ data: { caseId, rating: value } }));
                            }
                          }}
                          className="ml-2 rounded-[10px] border border-border bg-card px-2 py-1"
                        >
                          <option value="" disabled>
                            —
                          </option>
                          {[1, 2, 3, 4].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <CardTitle>Self-review</CardTitle>
                  <span className="rounded-full bg-bone px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
                    Input, not the rating
                  </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                {person.selfReview === undefined || selfEntries.length === 0 ? (
                  <p className="text-muted-foreground">
                    {person.selfReview === undefined
                      ? "Not visible, or no self-review on record."
                      : "The self-review has no content yet."}
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {person.selfReviewSubmittedAt === undefined && (
                      <p className="text-xs text-muted-foreground">Draft — not yet submitted.</p>
                    )}
                    {selfEntries.map((entry) => (
                      <div key={entry.label}>
                        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                          {entry.label}
                        </p>
                        <p className="leading-relaxed text-ink-700">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Manager assessment</CardTitle>
                  <p className="text-sm text-muted-foreground">Evidence-based</p>
                </CardHeader>
                <CardContent className="text-sm">
                  {person.assessment === undefined ? (
                    <p className="text-muted-foreground">
                      {person.canReview
                        ? "No assessment on record yet — write it from the Assessment surface."
                        : "Visible to reviewers."}
                    </p>
                  ) : (
                    <div className="border-l-2 border-ink-100 pl-4 leading-relaxed text-ink-700">
                      {person.assessment.narrative !== ""
                        ? person.assessment.narrative
                        : "No overall narrative yet."}
                    </div>
                  )}
                </CardContent>
              </Card>

              {person.assessment !== undefined && (
                <Card>
                  <CardHeader>
                    <CardTitle>Proposal to calibration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-muted-foreground">Performance rating</span>
                      <span className="font-semibold">
                        {person.assessment.proposedRating !== undefined &&
                        isReviewRating(person.assessment.proposedRating)
                          ? REVIEW_RATING_LABELS[person.assessment.proposedRating]
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-muted-foreground">Promotion readiness</span>
                      <span className="font-semibold">
                        {person.assessment.promoProposed ? "Promotion proposed" : "At level"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Compensation recommendation</span>
                      <span className="font-semibold">
                        {person.assessment.compRec !== "" ? person.assessment.compRec : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {(person.appeal !== undefined || person.canAppeal) && (
            <Card>
              <CardHeader>
                <CardTitle>Appeal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {person.appeal !== undefined ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
                        {APPEAL_CATEGORY_LABEL[person.appeal.category]}
                      </span>
                      <span
                        className={
                          person.appeal.status === "resolved"
                            ? "text-muted-foreground"
                            : "font-semibold text-[var(--color-warning)]"
                        }
                      >
                        {person.appeal.status === "resolved" ? "Resolved" : "Open"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Filed {new Date(person.appeal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{person.appeal.statement}</p>
                    {person.appeal.resolution !== undefined && (
                      <div className="rounded-[10px] bg-cream px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Resolution
                        </span>
                        <p className="mt-1 whitespace-pre-wrap">{person.appeal.resolution}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-muted-foreground">
                      You may appeal this decision within the 30-day window. Appeals go to HR
                      (Admins) and are kept out of performance views.
                    </p>
                    <label className="block text-xs">
                      Category
                      <select
                        value={appealCategory}
                        onChange={(event) =>
                          setAppealCategory(event.target.value as AppealCategory)
                        }
                        className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                      >
                        {APPEAL_CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {APPEAL_CATEGORY_LABEL[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      value={appealStatement}
                      onChange={(event) => setAppealStatement(event.target.value)}
                      rows={4}
                      maxLength={4000}
                      placeholder="Explain, with specifics, why you believe the decision should be reconsidered."
                      className="block w-full rounded-[10px] border border-border bg-card px-3 py-2"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || appealStatement.trim().length === 0}
                      onClick={() => {
                        const caseId = reviewCase?.id;
                        if (caseId !== undefined) {
                          void run(() =>
                            fileAppealFn({
                              data: {
                                caseId,
                                category: appealCategory,
                                statement: appealStatement.trim(),
                              },
                            }),
                          );
                        }
                      }}
                    >
                      Submit appeal
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "Compensation" && person.canViewComp && (
        <Card>
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!isSalaryBandApplicable(person.employmentType) && (
              <p className="rounded-[10px] bg-cream px-3 py-2 text-xs text-muted-foreground">
                Outside salary bands — {EMPLOYMENT_TYPE_LABELS[person.employmentType]} contracts are
                not band-governed.
              </p>
            )}
            {reviewCase === undefined ? (
              <span className="text-muted-foreground">
                Compensation is recorded against the review case — none for this cycle yet.
              </span>
            ) : comp === null ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Compensation is confidential — opening it is recorded in the audit trail.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const caseId = reviewCase.id;
                    setBusy(true);
                    void compFn({ data: { caseId } })
                      .then((view) => setComp(view))
                      .finally(() => setBusy(false));
                  }}
                >
                  View compensation
                </Button>
              </div>
            ) : comp.recommendation === undefined ? (
              <span className="text-muted-foreground">No compensation recommendation yet.</span>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Current base</dt>
                    <dd className="font-semibold">
                      €{comp.recommendation.currentBaseEur.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Increase</dt>
                    <dd className="font-semibold">
                      €{comp.recommendation.increaseEur.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Bonus</dt>
                    <dd className="font-semibold">
                      €{comp.recommendation.bonusEur.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">New base</dt>
                    <dd className="font-semibold">
                      €{comp.recommendation.newBaseEur.toLocaleString()}
                    </dd>
                  </div>
                </dl>
                {comp.recommendation.rationale !== undefined && (
                  <div className="border-t border-border pt-3">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                      Decision rationale
                    </p>
                    <p className="leading-relaxed text-ink-700">{comp.recommendation.rationale}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "History" && (
        <Card>
          <CardHeader>
            <CardTitle>Record & decision history</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {(() => {
              const events: { date: string; title: string; detail: string }[] = [];
              if (person.appeal !== undefined && person.appeal.status === "resolved") {
                events.push({
                  date: person.appeal.createdAt,
                  title: "Appeal resolved",
                  detail: person.appeal.resolution ?? "",
                });
              }
              if (person.appeal !== undefined) {
                events.push({
                  date: person.appeal.createdAt,
                  title: `Appeal filed · ${APPEAL_CATEGORY_LABEL[person.appeal.category]}`,
                  detail: "Visible to HR Admins and the appellant only.",
                });
              }
              if (reviewCase?.decidedAt !== undefined) {
                events.push({
                  date: reviewCase.decidedAt,
                  title: "Decision delivered",
                  detail: `Dual founder sign-off complete${reviewCase.p6Triggered ? " · P6 improvement plan triggered" : ""}. Appeal window until ${
                    reviewCase.appealUntil !== undefined
                      ? new Date(reviewCase.appealUntil).toLocaleDateString()
                      : "—"
                  }.`,
                });
              }
              if (person.selfReviewSubmittedAt !== undefined) {
                events.push({
                  date: person.selfReviewSubmittedAt,
                  title: "Self-review submitted",
                  detail: "Input, not the rating.",
                });
              }
              if (events.length === 0) {
                return (
                  <p className="text-muted-foreground">
                    Nothing on record yet for the 2026 cycle
                    {reviewCase !== undefined &&
                      ` — the case is at ${STATE_LABEL[reviewCase.state]}`}
                    .
                  </p>
                );
              }
              return (
                <div className="flex flex-col">
                  {events.map((event, index) => (
                    <div key={`${event.title}-${index}`} className="flex items-start gap-4">
                      <span className="flex flex-col items-center self-stretch">
                        <span
                          className={
                            index === 0
                              ? "mt-1 size-2.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                              : "mt-1 size-2.5 shrink-0 rounded-full bg-[#1e3a8a]"
                          }
                        />
                        {index < events.length - 1 && (
                          <span
                            className="w-0.5 flex-1 bg-[#e9e4da]"
                            style={{ minHeight: "26px" }}
                          />
                        )}
                      </span>
                      <div className="pb-5">
                        <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                          {new Date(event.date).toLocaleDateString()}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">{event.title}</p>
                        {event.detail !== "" && (
                          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
