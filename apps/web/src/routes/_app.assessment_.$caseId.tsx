import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { TwoColumnRoutePending } from "../components/route-pending/shapes.tsx";
import {
  CAREER_LEVEL_META,
  CAREER_LEVELS,
  EVALUATION_DIMENSIONS,
  EVALUATION_DIMENSION_LABELS,
  REVIEW_RATING_LABELS,
  canSubmitAssessment,
  isReviewRating,
} from "@agds-hr/people/types";
import type { EvaluationDimension, PeerKind, ReviewRating } from "@agds-hr/people/types";

import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { AssessCaseDetail } from "../server/people.shared.ts";
import { selfReviewEntries } from "../server/people.shared.ts";
import { assessDetailFn, assessSaveFn, assessSubmitFn } from "../server/people.functions.ts";

// The dedicated assessment page (one case = one page, like the peer answer
// form): evidence panels — self-review, level expectations, peer input — next
// to the manager assessment form. Reached from the /assessment list.
export const Route = createFileRoute("/_app/assessment_/$caseId")({
  loader: ({ params }) => assessDetailFn({ data: params.caseId }),
  pendingComponent: () => <TwoColumnRoutePending width="5xl" />,
  component: AssessCasePage,
});

type DimDraft = { score: number | undefined; narrative: string; evidence: string };
type Draft = {
  dims: Record<EvaluationDimension, DimDraft>;
  narrative: string;
  proposedRating: number | undefined;
  promoProposed: boolean;
  compRec: string;
  p6Acknowledged: boolean;
};

const emptyDraft = (): Draft => ({
  dims: Object.fromEntries(
    EVALUATION_DIMENSIONS.map((dimension) => [
      dimension,
      { score: undefined, narrative: "", evidence: "" },
    ]),
  ) as Record<EvaluationDimension, DimDraft>,
  narrative: "",
  proposedRating: undefined,
  promoProposed: false,
  compRec: "",
  p6Acknowledged: false,
});

const draftFromDetail = (detail: AssessCaseDetail): Draft => {
  const base = emptyDraft();
  const existing = detail.assessment;
  if (existing === undefined) {
    return base;
  }
  for (const dimension of EVALUATION_DIMENSIONS) {
    const entry = existing.dims[dimension];
    if (entry !== undefined) {
      base.dims[dimension] = {
        score: entry.score,
        narrative: entry.narrative,
        evidence: entry.evidence,
      };
    }
  }
  return {
    ...base,
    narrative: existing.narrative,
    proposedRating: existing.proposedRating,
    promoProposed: existing.promoProposed,
    compRec: existing.compRec,
    p6Acknowledged: existing.p6Acknowledged,
  };
};

const toPayload = (caseId: string, draft: Draft) => ({
  caseId,
  dims: Object.fromEntries(
    EVALUATION_DIMENSIONS.flatMap((dimension) => {
      const entry = draft.dims[dimension];
      return entry.score === undefined &&
        entry.narrative.trim() === "" &&
        entry.evidence.trim() === ""
        ? []
        : [
            [
              dimension,
              { score: entry.score ?? 3, narrative: entry.narrative, evidence: entry.evidence },
            ],
          ];
    }),
  ),
  narrative: draft.narrative,
  ...(draft.proposedRating !== undefined ? { proposedRating: draft.proposedRating } : {}),
  promoProposed: draft.promoProposed,
  compRec: draft.compRec,
  p6Acknowledged: draft.p6Acknowledged,
});

const isComplete = (draft: Draft): boolean => {
  const dims: Partial<
    Record<EvaluationDimension, { score: ReviewRating; narrative: string; evidence: string }>
  > = {};
  for (const dimension of EVALUATION_DIMENSIONS) {
    const entry = draft.dims[dimension];
    if (entry.score !== undefined && isReviewRating(entry.score)) {
      dims[dimension] = {
        score: entry.score,
        narrative: entry.narrative,
        evidence: entry.evidence,
      };
    }
  }
  return canSubmitAssessment({
    dims,
    proposedRating:
      draft.proposedRating !== undefined && isReviewRating(draft.proposedRating)
        ? draft.proposedRating
        : undefined,
    p6Acknowledged: draft.p6Acknowledged,
  });
};

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";

const KIND_LABEL: Record<PeerKind, string> = {
  lt: "LT peer",
  team: "Own team",
  cross: "Cross-team",
};

function AssessCasePage() {
  const detail: AssessCaseDetail = Route.useLoaderData();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFromDetail(detail));
  const [busy, setBusy] = useState(false);
  const [showSelf, setShowSelf] = useState(false);
  const [showPeers, setShowPeers] = useState(false);

  const submitted = detail.assessment?.submittedAt !== undefined;
  const lowRating = draft.proposedRating !== undefined && draft.proposedRating <= 2;
  const complete = isComplete(draft);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const setDim = (dimension: EvaluationDimension, patch: Partial<DimDraft>) =>
    setDraft((prev) => ({
      ...prev,
      dims: { ...prev.dims, [dimension]: { ...prev.dims[dimension], ...patch } },
    }));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        to="/assessment"
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        ← All reports
      </Link>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Manager assessment
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
        {detail.subjectName ?? detail.subjectEmail}
      </h1>

      <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[rgba(233,75,60,0.28)] bg-[#fffbfa] px-4 py-3.5">
        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-bold text-white">
          !
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-[var(--color-accent-dk)]">
            Assessments must be evidence-based; vague impressions are not sufficient.
          </p>
          <p className="text-xs text-muted-foreground">
            Every dimension needs a narrative and at least one linked piece of evidence. Submission
            is blocked while any evidence field is empty.
          </p>
        </div>
      </div>

      {!detail.direct && (
        <div className="mt-4 rounded-[14px] border border-[var(--color-warning)]/40 bg-[var(--color-warning-surface)] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          <strong>{detail.subjectName ?? detail.subjectEmail} is an indirect report</strong> — this
          assessment should normally be written by their direct manager. Proceed only if you have
          agreed to cover it.
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{detail.subjectName ?? detail.subjectEmail}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {detail.level !== undefined
                  ? `${detail.level} · ${CAREER_LEVEL_META[detail.level].name}`
                  : "Level unassigned"}
                {detail.path !== undefined && ` · ${detail.path === "ic" ? "IC" : "Management"}`}
              </p>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="mb-2.5 flex items-baseline justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Self-review · input, not rating
                  {detail.selfReviewSubmittedAt === undefined && " · not yet submitted"}
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                  onClick={() => setShowSelf((value) => !value)}
                >
                  {showSelf ? "Hide" : "Show"}
                </button>
              </div>
              {showSelf &&
                (selfReviewEntries(detail.selfReview).length === 0 ? (
                  <p className="text-muted-foreground">No self-review content yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selfReviewEntries(detail.selfReview).map((entry) => (
                      <div key={entry.label}>
                        <p className="text-[12.5px] font-semibold">{entry.label}</p>
                        <p className="text-[13px] leading-relaxed text-ink-700">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                ))}
            </CardContent>
          </Card>

          {detail.level !== undefined && (
            <Card>
              <CardContent className="pt-5 text-sm">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Level expectations
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 rounded-lg bg-cream px-2 py-0.5 text-xs font-bold">
                      Now
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-700">
                      {CAREER_LEVEL_META[detail.level].test}
                    </span>
                  </div>
                  {detail.level !== "L4" && (
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 rounded-lg bg-bone px-2 py-0.5 text-xs font-bold text-ink-300">
                        {CAREER_LEVELS[CAREER_LEVELS.indexOf(detail.level) + 1]}
                      </span>
                      <span className="text-[13px] leading-relaxed text-muted-foreground">
                        {
                          CAREER_LEVEL_META[CAREER_LEVELS[CAREER_LEVELS.indexOf(detail.level) + 1]!]
                            .test
                        }
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-5 text-sm">
              <div className="mb-2.5 flex items-baseline justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Peer input · named, not shown to the subject
                </p>
                {detail.peers.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                    onClick={() => setShowPeers((value) => !value)}
                  >
                    {showPeers ? "Hide" : "Show"}
                  </button>
                )}
              </div>
              {detail.peers.length === 0 ? (
                <p className="text-muted-foreground">No submitted peer input yet.</p>
              ) : (
                showPeers && (
                  <div className="space-y-4">
                    {detail.peers.map((peer) => (
                      <div key={peer.requesteeEmail}>
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          From {peer.requesteeName ?? peer.requesteeEmail} · {KIND_LABEL[peer.kind]}
                        </p>
                        <div className="space-y-2">
                          {EVALUATION_DIMENSIONS.filter(
                            (dimension) => (peer.input[dimension] ?? "") !== "",
                          ).map((dimension) => (
                            <div key={dimension}>
                              <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                                {EVALUATION_DIMENSION_LABELS[dimension]}
                              </p>
                              <p className="text-[13px] leading-relaxed text-ink-700">
                                {peer.input[dimension]}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2.5 pt-5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Peer input</span>
                <span className="font-semibold tabular-nums">
                  {detail.peerSubmitted} submitted
                  {detail.peerDeclined > 0 && ` · ${detail.peerDeclined} declined`}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Current case rating</span>
                <span className="font-semibold tabular-nums">
                  {detail.priorRating !== undefined && isReviewRating(detail.priorRating)
                    ? `${detail.priorRating} · ${REVIEW_RATING_LABELS[detail.priorRating]}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Case state</span>
                <span className="font-semibold">{detail.state.replace(/_/g, " ")}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manager assessment</CardTitle>
            {submitted && (
              <p className="text-sm font-semibold text-[#1e7a46]">
                Submitted{" "}
                {detail.assessment?.submittedAt !== undefined &&
                  new Date(detail.assessment.submittedAt).toLocaleDateString()}{" "}
                — read-only.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {EVALUATION_DIMENSIONS.map((dimension) => {
              const entry = draft.dims[dimension];
              return (
                <div key={dimension} className="rounded-[14px] border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-bold">
                      {EVALUATION_DIMENSION_LABELS[dimension]}
                    </span>
                    <select
                      value={entry.score ?? ""}
                      disabled={submitted}
                      onChange={(event) =>
                        setDim(dimension, {
                          score: event.target.value === "" ? undefined : Number(event.target.value),
                        })
                      }
                      className="rounded-[10px] border border-border bg-card px-2 py-1 text-xs"
                    >
                      <option value="">score…</option>
                      {[1, 2, 3, 4].map((score) => (
                        <option key={score} value={score}>
                          {score} · {REVIEW_RATING_LABELS[score as ReviewRating]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={4000}
                    placeholder="Narrative — what happened, against level expectations"
                    value={entry.narrative}
                    disabled={submitted}
                    onChange={(event) => setDim(dimension, { narrative: event.target.value })}
                    className={inputCls}
                  />
                  <input
                    maxLength={4000}
                    placeholder="Evidence — a linked artefact, metric, or concrete moment (required)"
                    value={entry.evidence}
                    disabled={submitted}
                    onChange={(event) => setDim(dimension, { evidence: event.target.value })}
                    className={`${inputCls} mt-2`}
                  />
                </div>
              );
            })}

            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">
                Overall narrative
              </label>
              <textarea
                rows={3}
                maxLength={8000}
                placeholder="The proposal to calibration, in plain words"
                value={draft.narrative}
                disabled={submitted}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, narrative: event.target.value }))
                }
                className={inputCls}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
              <label className="text-xs">
                <span className="mb-1 block font-semibold text-ink-700">Proposed rating</span>
                <select
                  value={draft.proposedRating ?? ""}
                  disabled={submitted}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      proposedRating:
                        event.target.value === "" ? undefined : Number(event.target.value),
                    }))
                  }
                  className="rounded-[10px] border border-border bg-card px-2 py-1.5"
                >
                  <option value="">—</option>
                  {[1, 2, 3, 4].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} · {REVIEW_RATING_LABELS[rating as ReviewRating]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input
                  type="checkbox"
                  checked={draft.promoProposed}
                  disabled={submitted}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, promoProposed: event.target.checked }))
                  }
                />
                Promotion proposed
              </label>
              <label className="min-w-40 flex-1 text-xs">
                <span className="mb-1 block font-semibold text-ink-700">
                  Compensation recommendation (type only)
                </span>
                <input
                  maxLength={200}
                  placeholder='e.g. "+4% + bonus" — amounts are set by Admins at sign-off'
                  value={draft.compRec}
                  disabled={submitted}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, compRec: event.target.value }))
                  }
                  className={inputCls}
                />
              </label>
            </div>

            {lowRating && (
              <div className="flex items-start gap-3 rounded-xl border border-[rgba(233,75,60,0.28)] bg-[#fbf1ee] px-4 py-3">
                <span className="shrink-0 rounded-md bg-[var(--color-blush)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-accent-dk)]">
                  Improvement plan
                </span>
                <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[#8a3325]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.p6Acknowledged}
                    disabled={submitted}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, p6Acknowledged: event.target.checked }))
                    }
                  />
                  A rating of 1 or 2 starts an improvement plan for this person. Please confirm you
                  understand before submitting.
                </label>
              </div>
            )}

            {!submitted && (
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void run(() => assessSaveFn({ data: toPayload(detail.caseId, draft) }));
                  }}
                >
                  Save draft
                </Button>
                <div className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !complete}
                    onClick={() => {
                      void run(() => assessSubmitFn({ data: toPayload(detail.caseId, draft) }));
                    }}
                  >
                    Submit assessment
                  </Button>
                  {!complete && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Enabled once every dimension has a score, narrative & evidence
                      {lowRating && " and the improvement plan is acknowledged"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
