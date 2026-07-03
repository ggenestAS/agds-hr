import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
import { SelfReviewReadView } from "../components/self-review-read.tsx";
import type { AssessCaseDetail } from "../server/people.shared.ts";
import { selfReviewEntries } from "../server/people.shared.ts";
import { assessDetailFn, assessSaveFn, assessSubmitFn } from "../server/people.functions.ts";

// The dedicated assessment page (one case = one page, like the peer answer
// form), split into three tabs: the manager's own assessment form, the
// subject's self-review, and the submitted peer input. "Copy as .md" exports
// all three as one Markdown document.
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

// A dimension counts as written once it has all three: score, narrative,
// evidence. Drives the per-dimension ✓ and the progress pill.
const isDimDone = (entry: DimDraft): boolean =>
  entry.score !== undefined && entry.narrative.trim() !== "" && entry.evidence.trim() !== "";

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

const ratingLabel = (score: number | undefined): string =>
  score !== undefined && isReviewRating(score) ? `${score} · ${REVIEW_RATING_LABELS[score]}` : "—";

// The full case as one Markdown document — manager assessment (current draft,
// so unsaved edits are included), self-review, and peer input.
const buildMarkdown = (detail: AssessCaseDetail, draft: Draft): string => {
  const name = detail.subjectName ?? detail.subjectEmail;
  const lines: string[] = [`# Review — ${name}`];
  const meta = [
    detail.level !== undefined
      ? `${detail.level} · ${CAREER_LEVEL_META[detail.level].name}`
      : undefined,
    detail.path !== undefined ? (detail.path === "ic" ? "IC path" : "Management") : undefined,
    `case state: ${detail.state.replace(/_/g, " ")}`,
  ].filter((part): part is string => part !== undefined);
  lines.push(meta.join(" · "), "");

  const assessedAt = detail.assessment?.submittedAt;
  lines.push(
    `## Manager assessment${
      assessedAt !== undefined
        ? ` — submitted ${new Date(assessedAt).toLocaleDateString()}`
        : " — draft"
    }`,
    "",
  );
  for (const dimension of EVALUATION_DIMENSIONS) {
    const entry = draft.dims[dimension];
    if (
      entry.score === undefined &&
      entry.narrative.trim() === "" &&
      entry.evidence.trim() === ""
    ) {
      continue;
    }
    lines.push(`### ${EVALUATION_DIMENSION_LABELS[dimension]} — ${ratingLabel(entry.score)}`, "");
    if (entry.narrative.trim() !== "") {
      lines.push(entry.narrative.trim(), "");
    }
    if (entry.evidence.trim() !== "") {
      lines.push(`Evidence: ${entry.evidence.trim()}`, "");
    }
  }
  if (draft.narrative.trim() !== "") {
    lines.push("**Overall narrative**", "", draft.narrative.trim(), "");
  }
  lines.push(`Proposed rating: ${ratingLabel(draft.proposedRating)}`);
  lines.push(`Promotion proposed: ${draft.promoProposed ? "yes" : "no"}`);
  if (draft.compRec.trim() !== "") {
    lines.push(`Compensation recommendation: ${draft.compRec.trim()}`);
  }
  lines.push("");

  lines.push(
    `## Self-review${
      detail.selfReviewSubmittedAt !== undefined
        ? ` — submitted ${new Date(detail.selfReviewSubmittedAt).toLocaleDateString()}`
        : " — not submitted"
    }`,
    "",
  );
  const entries = selfReviewEntries(detail.selfReview);
  if (entries.length === 0) {
    lines.push("No content.", "");
  }
  for (const entry of entries) {
    lines.push(`**${entry.label}**`, "", entry.value, "");
  }

  lines.push(`## Peer input — ${detail.peers.length} submitted`, "");
  if (detail.peers.length === 0) {
    lines.push("None yet.", "");
  }
  for (const peer of detail.peers) {
    lines.push(
      `### From ${peer.requesteeName ?? peer.requesteeEmail} · ${KIND_LABEL[peer.kind]}`,
      "",
    );
    for (const dimension of EVALUATION_DIMENSIONS) {
      const value = (peer.input[dimension] ?? "").trim();
      if (value !== "") {
        lines.push(`**${EVALUATION_DIMENSION_LABELS[dimension]}** — ${value}`, "");
      }
    }
  }
  return lines.join("\n");
};

type AssessTab = "yours" | "self" | "peers";

const TAB_LABEL: Record<AssessTab, string> = {
  yours: "Your assessment",
  self: "Self-review",
  peers: "Peer input",
};

function AssessCasePage() {
  const detail: AssessCaseDetail = Route.useLoaderData();
  const router = useRouter();
  const storageKey = `agds_assessment_${detail.caseId}`;
  const [draft, setDraft] = useState<Draft>(() => draftFromDetail(detail));
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<AssessTab>("yours");

  const submitted = detail.assessment?.submittedAt !== undefined;
  const lowRating = draft.proposedRating !== undefined && draft.proposedRating <= 2;
  const complete = isComplete(draft);
  const doneCount = EVALUATION_DIMENSIONS.filter((dimension) =>
    isDimDone(draft.dims[dimension]),
  ).length;

  // Local draft safety net (same pattern as the peer answer form): restore an
  // unsaved local draft only when the server holds nothing — an explicit
  // server save always wins. Cleared on submit.
  useEffect(() => {
    if (submitted || detail.assessment !== undefined) {
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const local = JSON.parse(raw) as Draft;
        if (local.dims !== undefined) {
          setDraft({ ...emptyDraft(), ...local, dims: { ...emptyDraft().dims, ...local.dims } });
        }
      }
    } catch {
      // ignore unreadable local drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (updater: (prev: Draft) => Draft) =>
    setDraft((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage full/unavailable — the explicit Save draft still works
      }
      return next;
    });

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
    update((prev) => ({
      ...prev,
      dims: { ...prev.dims, [dimension]: { ...prev.dims[dimension], ...patch } },
    }));

  const copyMarkdown = () => {
    void navigator.clipboard.writeText(buildMarkdown(detail, draft)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const selfMissing = detail.selfReviewSubmittedAt === undefined;
  const noPeerInput = detail.peers.length === 0;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        to="/assessment"
        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Assessment
      </Link>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Manager assessment
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {detail.subjectName ?? detail.subjectEmail}
        </h1>
        <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
          {detail.state.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {detail.level !== undefined
          ? `${detail.level} · ${CAREER_LEVEL_META[detail.level].name}`
          : "Level unassigned"}
        {detail.path !== undefined && ` · ${detail.path === "ic" ? "IC path" : "Management"}`}
        {" · "}
        {detail.peerSubmitted} peer {detail.peerSubmitted === 1 ? "input" : "inputs"} submitted
      </p>

      {!detail.direct && (
        <div className="mt-4 rounded-[14px] border border-[var(--color-warning)]/40 bg-[var(--color-warning-surface)] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          <strong>{detail.subjectName ?? detail.subjectEmail} is an indirect report</strong> — this
          assessment should normally be written by their direct manager. Proceed only if you have
          agreed to cover it.
        </div>
      )}

      {!submitted && (selfMissing || noPeerInput) && (
        <div className="mt-4 rounded-[14px] border border-[var(--color-warning)]/40 bg-[var(--color-warning-surface)] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          <strong>The evidence base is still thin.</strong>{" "}
          {selfMissing && "The self-review has not been submitted yet. "}
          {noPeerInput && "No peer input has come in yet — you can set reviewers on the "}
          {noPeerInput && (
            <Link to="/peer-input" className="font-semibold underline">
              peer input page
            </Link>
          )}
          {noPeerInput && ". "}
          You can draft now, but consider waiting before you submit.
        </div>
      )}

      <div className="mb-6 mt-5 flex items-center gap-6 border-b border-border">
        {(["yours", "self", "peers"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setTab(entry)}
            className={
              entry === tab
                ? "-mb-px flex items-center gap-2 border-b-2 border-[var(--color-accent)] pb-3 text-sm font-semibold"
                : "-mb-px flex items-center gap-2 border-b-2 border-transparent pb-3 text-sm font-semibold text-ink-300 hover:text-ink-500"
            }
          >
            {TAB_LABEL[entry]}
            {entry === "yours" && !submitted && (
              <span className="rounded-full bg-bone px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums text-ink-500">
                {doneCount}/{EVALUATION_DIMENSIONS.length}
              </span>
            )}
            {entry === "peers" && detail.peers.length > 0 && (
              <span className="rounded-full bg-bone px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums text-ink-500">
                {detail.peers.length}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={copyMarkdown}
          className="-mb-px ml-auto pb-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {copied ? "Copied ✓" : "Copy as .md"}
        </button>
      </div>

      {/* ---- Your assessment: the form, with level expectations alongside ---- */}
      {tab === "yours" && (
        <div className="grid items-start gap-5 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="flex flex-col gap-4">
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
                      <span className="text-[13px] leading-relaxed text-foreground">
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
                            CAREER_LEVEL_META[
                              CAREER_LEVELS[CAREER_LEVELS.indexOf(detail.level) + 1]!
                            ].test
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle>Your assessment</CardTitle>
                {!submitted && (
                  <span
                    className={
                      doneCount === EVALUATION_DIMENSIONS.length
                        ? "rounded-full bg-[var(--color-success-surface)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--color-success)]"
                        : "rounded-full bg-bone px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-ink-500"
                    }
                  >
                    {doneCount}/{EVALUATION_DIMENSIONS.length} dimensions
                  </span>
                )}
              </div>
              {submitted ? (
                <p className="text-sm font-semibold text-[var(--color-success)]">
                  Submitted{" "}
                  {detail.assessment?.submittedAt !== undefined &&
                    new Date(detail.assessment.submittedAt).toLocaleDateString()}{" "}
                  — read-only.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Evidence-based only: every dimension needs a score, a narrative, and at least one
                  linked artefact, metric, or concrete moment.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {EVALUATION_DIMENSIONS.map((dimension) => {
                const entry = draft.dims[dimension];
                const done = isDimDone(entry);
                return (
                  <div key={dimension} className="rounded-[14px] border border-border p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
                        {EVALUATION_DIMENSION_LABELS[dimension]}
                        {done && !submitted && (
                          <span className="text-[var(--color-success)]">✓</span>
                        )}
                      </span>
                      <select
                        value={entry.score ?? ""}
                        disabled={submitted}
                        onChange={(event) =>
                          setDim(dimension, {
                            score:
                              event.target.value === "" ? undefined : Number(event.target.value),
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
                <label className="mb-1.5 block text-[12.5px] font-semibold text-foreground">
                  Overall narrative
                </label>
                <textarea
                  rows={3}
                  maxLength={8000}
                  placeholder="The proposal to calibration, in plain words"
                  value={draft.narrative}
                  disabled={submitted}
                  onChange={(event) =>
                    update((prev) => ({ ...prev, narrative: event.target.value }))
                  }
                  className={inputCls}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
                <label className="text-xs">
                  <span className="mb-1 block font-semibold text-foreground">Proposed rating</span>
                  <select
                    value={draft.proposedRating ?? ""}
                    disabled={submitted}
                    onChange={(event) =>
                      update((prev) => ({
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
                      update((prev) => ({ ...prev, promoProposed: event.target.checked }))
                    }
                  />
                  Promotion proposed
                </label>
                <label className="min-w-40 flex-1 text-xs">
                  <span className="mb-1 block font-semibold text-foreground">
                    Compensation recommendation (type only)
                  </span>
                  <input
                    maxLength={200}
                    placeholder='e.g. "+4% + bonus" — amounts are set by Admins at sign-off'
                    value={draft.compRec}
                    disabled={submitted}
                    onChange={(event) =>
                      update((prev) => ({ ...prev, compRec: event.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
              </div>

              {lowRating && (
                <div className="flex items-start gap-3 rounded-xl border border-[rgba(233,75,60,0.28)] bg-[var(--color-accent-tint-surface)] px-4 py-3">
                  <span className="shrink-0 rounded-md bg-[var(--color-blush)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-accent-dk)]">
                    Improvement plan
                  </span>
                  <label className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-accent-tint-text)]">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={draft.p6Acknowledged}
                      disabled={submitted}
                      onChange={(event) =>
                        update((prev) => ({ ...prev, p6Acknowledged: event.target.checked }))
                      }
                    />
                    A rating of 1 or 2 starts an improvement plan for this person. Please confirm
                    you understand before submitting.
                  </label>
                </div>
              )}

              {!submitted && (
                <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                  {savedAt !== null && (
                    <span className="mr-auto text-xs text-muted-foreground">
                      Draft saved at {savedAt} ✓
                    </span>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void run(async () => {
                        await assessSaveFn({ data: toPayload(detail.caseId, draft) });
                        setSavedAt(new Date().toLocaleTimeString([], { timeStyle: "short" }));
                      });
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
                        void run(async () => {
                          await assessSubmitFn({ data: toPayload(detail.caseId, draft) });
                          try {
                            localStorage.removeItem(storageKey);
                          } catch {
                            // best-effort cleanup
                          }
                        });
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
      )}

      {/* ---- Self-review: the subject's own words, input not rating ---- */}
      {tab === "self" && (
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Self-review</CardTitle>
            <p className="text-sm text-muted-foreground">
              Input, not rating — {detail.subjectName ?? detail.subjectEmail}'s own words.
              {detail.selfReviewSubmittedAt !== undefined
                ? ` Submitted ${new Date(detail.selfReviewSubmittedAt).toLocaleDateString()}.`
                : " Not yet submitted."}
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            <SelfReviewReadView payload={detail.selfReview} />
          </CardContent>
        </Card>
      )}

      {/* ---- Peer input: named, never shown to the subject ---- */}
      {tab === "peers" && (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {detail.peers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No submitted peer input yet.
              </CardContent>
            </Card>
          ) : (
            detail.peers.map((peer) => (
              <Card key={peer.requesteeEmail}>
                <CardHeader>
                  <div className="flex items-baseline justify-between gap-3">
                    <CardTitle>{peer.requesteeName ?? peer.requesteeEmail}</CardTitle>
                    <span className="rounded-full bg-bone px-2.5 py-0.5 text-[11px] font-bold text-ink-500">
                      {KIND_LABEL[peer.kind]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Named, never shown to {detail.subjectName ?? "the subject"}.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {EVALUATION_DIMENSIONS.filter(
                    (dimension) => (peer.input[dimension] ?? "") !== "",
                  ).map((dimension) => (
                    <div key={dimension}>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                        {EVALUATION_DIMENSION_LABELS[dimension]}
                      </p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-foreground">
                        {peer.input[dimension]}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
