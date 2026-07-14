import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { StackedRoutePending } from "../components/route-pending/shapes.tsx";
import {
  APPEAL_CATEGORIES,
  CAREER_LEVELS,
  CAREER_LEVEL_META,
  CAREER_PATHS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EVALUATION_DIMENSIONS,
  EVALUATION_DIMENSION_LABELS,
  PEER_INPUT_KEYS,
  PEER_INPUT_KEY_LABELS,
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
  PeerInputKey,
  PeerKind,
  ReviewParticipationOverride,
  ReviewState,
} from "@agds-hr/people/types";
import { useState } from "react";

import { SelfReviewReadView } from "../components/self-review-read.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import type {
  AssessmentView,
  CompView,
  PersonDetail,
  ReceivedCycleView,
} from "../server/people.shared.ts";
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

// The employee record (improve-ux plan): dark hero + three tabs —
// Received reviews (per cycle: self, then peers, then manager — peers never
// shown to the subject), Given reviews (as manager, as peer), and Info
// (contract type, review participation, both managers, level/track, plus the
// operational cards: case controls, compensation, appeal).
export const Route = createFileRoute("/_app/people/$userId")({
  loader: ({ params }) => personDetailFn({ data: params.userId }),
  pendingComponent: () => <StackedRoutePending width="4xl" />,
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
const KIND_LABEL: Record<PeerKind, string> = {
  lt: "LT peer",
  team: "Own team",
  cross: "Cross-team",
};

const TABS = ["Received reviews", "Given reviews", "Info"] as const;
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
        rating >= 3 ? "bg-white/15 text-white" : "bg-coral text-[var(--color-coral-text)]"
      } ${large ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]"}`}
    >
      {REVIEW_RATING_LABELS[rating]}
    </span>
  ) : null;

function AssessmentBlock({ assessment }: { assessment: AssessmentView }) {
  return (
    <div className="space-y-4 text-sm">
      {assessment.narrative !== "" && (
        <div className="border-l-2 border-ink-100 pl-4 leading-relaxed text-foreground">
          {assessment.narrative}
        </div>
      )}
      <div className="space-y-3">
        {EVALUATION_DIMENSIONS.map((dimension) => {
          const entry = assessment.dims[dimension];
          if (entry === undefined) {
            return null;
          }
          return (
            <div key={dimension}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">
                  {EVALUATION_DIMENSION_LABELS[dimension]}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {isReviewRating(entry.score)
                    ? `${entry.score} · ${REVIEW_RATING_LABELS[entry.score]}`
                    : "—"}
                </span>
              </div>
              {entry.narrative !== "" && (
                <p className="text-xs leading-relaxed text-muted-foreground">{entry.narrative}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          Proposed rating:{" "}
          <strong className="text-foreground">
            {assessment.proposedRating !== undefined && isReviewRating(assessment.proposedRating)
              ? REVIEW_RATING_LABELS[assessment.proposedRating]
              : "—"}
          </strong>
        </span>
        <span>
          Promotion:{" "}
          <strong className="text-foreground">
            {assessment.promoProposed
              ? assessment.promoNote.trim() !== ""
                ? `proposed — ${assessment.promoNote}`
                : "proposed"
              : "at level"}
          </strong>
        </span>
        {assessment.compRec !== "" && (
          <span>
            Comp: <strong className="text-foreground">{assessment.compRec}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function PeerInputBlock({ input }: { input: Readonly<Partial<Record<PeerInputKey, string>>> }) {
  return (
    <div className="space-y-2.5">
      {PEER_INPUT_KEYS.filter((key) => (input[key] ?? "") !== "").map((key) => (
        <div key={key}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {PEER_INPUT_KEY_LABELS[key]}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">{input[key]}</p>
        </div>
      ))}
    </div>
  );
}

function ReceivedCycle({
  block,
  defaultOpen,
  isSubject,
}: {
  block: ReceivedCycleView;
  defaultOpen: boolean;
  isSubject: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <span className="font-display text-base font-semibold">Cycle {block.cycle}</span>
        <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent-tint-text)]">
          {STATE_LABEL[block.state]}
        </span>
        {block.rating !== undefined && isReviewRating(block.rating) && (
          <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-bold text-background">
            {REVIEW_RATING_LABELS[block.rating]}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{open ? "Hide −" : "Show +"}</span>
      </button>

      {open && (
        <CardContent className="space-y-5 border-t border-border pt-5 text-sm">
          {/* 1. self */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
              Self-review
              {block.self !== undefined && block.self.submittedAt === undefined && " · draft"}
            </p>
            {block.self === undefined ? (
              <p className="text-muted-foreground">No self-review yet.</p>
            ) : (
              <SelfReviewReadView payload={block.self.payload} />
            )}
          </div>

          {/* 2. peers — never rendered for the subject */}
          {!isSubject && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                Peer input · named, not shown to the subject
              </p>
              {block.peers === undefined ? (
                <p className="text-muted-foreground">Visible to the subject's managers only.</p>
              ) : block.peers.length === 0 ? (
                <p className="text-muted-foreground">No submitted peer input.</p>
              ) : (
                <div className="space-y-4">
                  {block.peers.map((peer) => (
                    <div key={peer.requesteeEmail}>
                      <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                        From {peer.requesteeName ?? peer.requesteeEmail} · {KIND_LABEL[peer.kind]}
                      </p>
                      <PeerInputBlock input={peer.input} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. manager */}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
              Manager assessment
            </p>
            {block.assessment === undefined ? (
              <p className="text-muted-foreground">No assessment yet.</p>
            ) : (
              <AssessmentBlock assessment={block.assessment} />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function PersonDetailPage() {
  const person: PersonDetail = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Received reviews");
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
  const [openGiven, setOpenGiven] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const reviewCase = person.reviewCase;
  const canSeeReceived = person.isSubject || person.managesSubject;
  const givenCycles = [
    ...new Set([
      ...person.givenAsManager.map((entry) => entry.cycle),
      ...person.givenAsPeer.map((entry) => entry.cycle),
    ]),
  ].sort((left, right) => right.localeCompare(left));

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
            {person.isLtMember && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Leadership team
              </span>
            )}
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
              <span>{EMPLOYMENT_TYPE_LABELS[person.employmentType]}</span>
            )}
            {person.campus !== undefined && <span>{person.campus}</span>}
            {person.managers[0] !== undefined && <span>Functional: {person.managers[0].name}</span>}
            {person.localManager !== undefined && <span>Local: {person.localManager.name}</span>}
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
        {TABS.map((entry) => (
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

      {tab === "Received reviews" && (
        <div className="flex flex-col gap-4">
          {!canSeeReceived ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Reviews are visible to {person.name.split(" ")[0]}, their managers (either reporting
                line), and leadership.
              </CardContent>
            </Card>
          ) : person.received.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No review cycles on record yet.
              </CardContent>
            </Card>
          ) : (
            person.received.map((block, index) => (
              <ReceivedCycle
                key={block.cycle}
                block={block}
                defaultOpen={index === 0}
                isSubject={person.isSubject}
              />
            ))
          )}
        </div>
      )}

      {tab === "Given reviews" && (
        <div className="flex flex-col gap-4">
          {givenCycles.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nothing visible here — reviews {person.name.split(" ")[0]} gave appear once
                submitted, and only for subjects you're allowed to see.
              </CardContent>
            </Card>
          ) : (
            givenCycles.map((cycle) => {
              const asManager = person.givenAsManager.filter((entry) => entry.cycle === cycle);
              const asPeer = person.givenAsPeer.filter((entry) => entry.cycle === cycle);
              return (
                <Card key={cycle} className="overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-border bg-cream px-6 py-3.5">
                    <span className="font-display text-base font-semibold">Cycle {cycle}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {asManager.length} as manager · {asPeer.length} as peer
                    </span>
                  </div>
                  <CardContent className="space-y-5 pt-5 text-sm">
                    {asManager.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                          Given as manager
                        </p>
                        <div className="space-y-3">
                          {asManager.map((entry) => (
                            <div
                              key={`${entry.cycle}-${entry.subjectEmail}`}
                              className="rounded-[14px] border border-border p-4"
                            >
                              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                                {entry.subjectUserId !== undefined ? (
                                  <Link
                                    to="/people/$userId"
                                    params={{ userId: entry.subjectUserId }}
                                    className="text-[13.5px] font-bold hover:text-[var(--color-accent)]"
                                  >
                                    {entry.subjectName ?? entry.subjectEmail}
                                  </Link>
                                ) : (
                                  <span className="text-[13.5px] font-bold">
                                    {entry.subjectName ?? entry.subjectEmail}
                                  </span>
                                )}
                                {entry.proposedRating !== undefined &&
                                  isReviewRating(entry.proposedRating) && (
                                    <span className="rounded-full bg-bone px-2.5 py-0.5 text-[10.5px] font-bold text-foreground">
                                      proposed {REVIEW_RATING_LABELS[entry.proposedRating]}
                                    </span>
                                  )}
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {entry.submittedAt !== undefined
                                    ? `submitted ${new Date(entry.submittedAt).toLocaleDateString()}`
                                    : "draft"}
                                </span>
                              </div>
                              {entry.narrative !== undefined && (
                                <p className="text-[13px] leading-relaxed text-foreground">
                                  {entry.narrative}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {asPeer.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)]">
                          Given as peer
                        </p>
                        <div className="space-y-3">
                          {asPeer.map((entry) => {
                            const key = `${entry.cycle}-${entry.subjectEmail}`;
                            const expanded = openGiven === key;
                            return (
                              <div key={key} className="rounded-[14px] border border-border p-4">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  {entry.subjectUserId !== undefined ? (
                                    <Link
                                      to="/people/$userId"
                                      params={{ userId: entry.subjectUserId }}
                                      className="text-[13.5px] font-bold hover:text-[var(--color-accent)]"
                                    >
                                      {entry.subjectName ?? entry.subjectEmail}
                                    </Link>
                                  ) : (
                                    <span className="text-[13.5px] font-bold">
                                      {entry.subjectName ?? entry.subjectEmail}
                                    </span>
                                  )}
                                  <span className="rounded-full bg-bone px-2 py-0.5 text-[10.5px] font-bold text-foreground">
                                    {KIND_LABEL[entry.kind]}
                                  </span>
                                  <span
                                    className={
                                      entry.status === "submitted"
                                        ? "rounded-full bg-[var(--color-success-surface)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--color-success)]"
                                        : "rounded-full bg-bone px-2 py-0.5 text-[10.5px] font-bold text-ink-500"
                                    }
                                  >
                                    {entry.status}
                                  </span>
                                  {entry.input !== undefined && (
                                    <button
                                      type="button"
                                      className="ml-auto text-xs font-medium text-muted-foreground underline hover:text-foreground"
                                      onClick={() => setOpenGiven(expanded ? null : key)}
                                    >
                                      {expanded ? "Hide content" : "Show content"}
                                    </button>
                                  )}
                                </div>
                                {expanded && entry.input !== undefined && (
                                  <div className="mt-3 border-t border-border pt-3">
                                    <PeerInputBlock input={entry.input} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "Info" && (
        <div className="flex flex-col gap-5">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Level & path</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {person.level !== undefined ? (
                  <div className="flex items-center gap-3 rounded-xl border border-foreground bg-cream px-3.5 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background">
                      {person.level}
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-bold">
                        {CAREER_LEVEL_META[person.level].name}
                        {person.path !== undefined && (
                          <span className="font-medium text-muted-foreground">
                            {" "}
                            · {PATH_LABEL[person.path]}
                          </span>
                        )}
                      </span>
                      <span className="block font-serif text-[13px] italic text-muted-foreground">
                        {CAREER_LEVEL_META[person.level].test}
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Level unassigned.</p>
                )}

                <div className="space-y-1.5 border-t border-border pt-3 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Contract type</span>
                    <span className="font-semibold">
                      {EMPLOYMENT_TYPE_LABELS[person.employmentType]}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">In the review cycle</span>
                    <span className="font-semibold">
                      {person.inReviewCycle ? "Yes" : "No"}
                      {person.reviewParticipationOverride !== null &&
                        ` (explicit ${person.reviewParticipationOverride})`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Salary bands</span>
                    <span className="font-semibold">
                      {isSalaryBandApplicable(person.employmentType)
                        ? "Band-governed"
                        : "Outside bands"}
                    </span>
                  </div>
                  {person.campus !== undefined && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Campus</span>
                      <span className="font-semibold">{person.campus}</span>
                    </div>
                  )}
                  {person.country !== undefined && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Country</span>
                      <span className="font-semibold">{person.country}</span>
                    </div>
                  )}
                </div>

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
                        onChange={(event) =>
                          setEmploymentType(event.target.value as EmploymentType)
                        }
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

            <Card>
              <CardHeader>
                <CardTitle>Managers</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Both reporting lines, from Albert Inside.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Local manager
                  </p>
                  {person.localManager === undefined ? (
                    <span className="text-muted-foreground">None on record.</span>
                  ) : (
                    <Link
                      to="/people/$userId"
                      params={{ userId: person.localManager.userId }}
                      className="font-medium hover:text-[var(--color-accent)]"
                    >
                      {person.localManager.name}
                      {person.localManager.title !== undefined && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {person.localManager.title}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Functional chain
                  </p>
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
                </div>
              </CardContent>
            </Card>
          </div>

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
                    <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-tint-text)]">
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
                        Improvement plan
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

          {person.canViewComp && (
            <Card>
              <CardHeader>
                <CardTitle>Compensation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!isSalaryBandApplicable(person.employmentType) && (
                  <p className="rounded-[10px] bg-cream px-3 py-2 text-xs text-muted-foreground">
                    Outside salary bands — {EMPLOYMENT_TYPE_LABELS[person.employmentType]} contracts
                    are not band-governed.
                  </p>
                )}
                {person.compPackage !== undefined && (
                  <div className="rounded-[10px] border border-border bg-cream/60 px-3 py-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Master record · FY {person.compPackage.compPeriod}
                    </p>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Fixed gross</dt>
                        <dd className="font-semibold">
                          €{person.compPackage.baseSalaryEur.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Variable target</dt>
                        <dd className="font-semibold">
                          €{person.compPackage.variableTargetEur.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
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
                        <p className="leading-relaxed text-foreground">
                          {comp.recommendation.rationale}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {(person.appeal !== undefined || person.canAppeal) && (
            <Card>
              <CardHeader>
                <CardTitle>Appeal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {person.appeal !== undefined ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-tint-text)]">
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
    </div>
  );
}
