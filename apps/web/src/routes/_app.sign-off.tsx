import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { REVIEW_RATING_LABELS, isReviewRating } from "@agds-hr/people/types";

import { TwoColumnRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { CompView, SignPageView, SignQueueEntry } from "../server/people.shared.ts";
import { compFn, signDecisionFn, signQueueFn } from "../server/people.functions.ts";

// Decision & sign-off (design M8): both founders must sign — two distinct,
// authenticated confirmations — before a decision summary is delivered.
// Delivery starts the 30-day appeal clock; ratings 1–2 auto-trigger P6.
export const Route = createFileRoute("/_app/sign-off")({
  loader: () => signQueueFn(),
  pendingComponent: () => <TwoColumnRoutePending width="5xl" />,
  component: SignOffPage,
});

const ratingChip = (rating: number | undefined) =>
  rating !== undefined && isReviewRating(rating) ? (
    <span
      className={
        rating >= 3
          ? "rounded-full bg-ink-900 px-2.5 py-0.5 text-[11.5px] font-bold text-white"
          : "rounded-full bg-coral px-2.5 py-0.5 text-[11.5px] font-bold text-[#5a2018]"
      }
    >
      {REVIEW_RATING_LABELS[rating]}
    </span>
  ) : (
    <span className="rounded-full bg-bone px-2.5 py-0.5 text-[11.5px] font-bold text-ink-500">
      In review
    </span>
  );

function SignOffPage() {
  const data: SignPageView = Route.useLoaderData();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comp, setComp] = useState<CompView | null>(null);
  const [busy, setBusy] = useState(false);

  const selected: SignQueueEntry | undefined =
    data.queue.find((entry) => entry.caseId === selectedId) ?? data.queue[0];

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const select = (caseId: string) => {
    setSelectedId(caseId);
    setComp(null);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Review cycle
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Decision & sign-off</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground">
        Every decision needs sign-off from both founders before the summary can be delivered. Once
        delivered, the employee has 30 days to appeal.
      </p>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Decision queue
          </p>
          {data.queue.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No cases at calibration or decision yet. Cases arrive here once the manager
                assessment is in and the case advances.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.queue.map((entry) => (
                <button
                  key={entry.caseId}
                  type="button"
                  onClick={() => select(entry.caseId)}
                  className={
                    entry.caseId === selected?.caseId
                      ? "flex w-full items-center gap-4 rounded-[14px] border border-ink-900 bg-card px-5 py-3.5 text-left shadow-[var(--shadow-soft)]"
                      : "flex w-full items-center gap-4 rounded-[14px] border border-border bg-card px-5 py-3.5 text-left shadow-[var(--shadow-soft)] hover:border-ink-500"
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {entry.subjectName ?? entry.subjectEmail}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.level ?? "—"}
                      {entry.compRecType !== "" && ` · ${entry.compRecType}`}
                      {entry.promoProposed && " · promotion proposed"}
                    </span>
                  </span>
                  {ratingChip(entry.rating)}
                  <span className="flex shrink-0 gap-1.5">
                    {[0, 1].map((slot) => {
                      const signer = entry.signoffs[slot];
                      return (
                        <span
                          key={slot}
                          title={signer}
                          className={
                            signer !== undefined
                              ? "rounded-full bg-[var(--color-success)] px-2.5 py-1 text-[10.5px] font-bold text-white"
                              : "rounded-full border border-border bg-bone px-2.5 py-1 text-[10.5px] font-bold text-ink-300"
                          }
                        >
                          {signer !== undefined
                            ? (signer.split("@")[0] ?? "✓").slice(0, 8)
                            : `Founder ${slot + 1}`}
                        </span>
                      );
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Select a case to preview its decision summary. Ratings of 1–2 automatically start an
            improvement plan when the decision is delivered.
          </p>
        </div>

        {selected !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>{selected.subjectName ?? selected.subjectEmail}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Decision summary — what {selected.subjectName ?? "the subject"} sees
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Rating</span>
                {ratingChip(selected.rating)}
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Compensation change</span>
                <span className="text-right font-bold">
                  {selected.compRecType !== "" ? selected.compRecType : "—"}
                </span>
              </div>
              {selected.promoProposed && (
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-muted-foreground">Promotion</span>
                  <span className="text-right font-bold">
                    {selected.promoNote.trim() !== "" ? selected.promoNote : "proposed"}
                  </span>
                </div>
              )}
              {selected.rationale !== "" && (
                <div>
                  <p className="mb-1 text-muted-foreground">Rationale</p>
                  <p className="leading-relaxed text-foreground">{selected.rationale}</p>
                </div>
              )}

              {data.canViewComp && (
                <div className="border-t border-border pt-3">
                  {comp === null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void compFn({ data: { caseId: selected.caseId } })
                          .then((view) => setComp(view))
                          .finally(() => setBusy(false));
                      }}
                    >
                      View amounts (recorded in the audit trail)
                    </Button>
                  ) : comp.recommendation === undefined ? (
                    <p className="text-muted-foreground">
                      No compensation recommendation recorded yet — Admins set amounts at sign-off.
                    </p>
                  ) : (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 tabular-nums">
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
                  )}
                </div>
              )}

              <div
                className={
                  selected.decidedAt !== undefined
                    ? "rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-surface)] px-4 py-3"
                    : "rounded-xl border border-border bg-cream px-4 py-3"
                }
              >
                {selected.decidedAt !== undefined ? (
                  <>
                    <p className="text-[12.5px] font-bold text-[var(--color-success)]">
                      Delivered {new Date(selected.decidedAt).toLocaleDateString()} — locked.
                    </p>
                    {selected.appealUntil !== undefined && (
                      <p className="mt-1 text-[12.5px] text-foreground">
                        The subject may appeal until{" "}
                        <strong>{new Date(selected.appealUntil).toLocaleDateString()}</strong>.
                        {selected.p6Triggered && " An improvement plan was started automatically."}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[12.5px] font-bold">
                      {selected.signoffs.length}/2 founder sign-offs
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">
                      The summary unlocks — and the 30-day appeal clock starts — at the second
                      distinct confirmation.
                    </p>
                    {data.canSign && selected.state === "decision" && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        disabled={busy || selected.signedByMe}
                        onClick={() => {
                          void run(() => signDecisionFn({ data: { caseId: selected.caseId } }));
                        }}
                      >
                        {selected.signedByMe ? "You have signed" : "Sign decision"}
                      </Button>
                    )}
                    {data.canSign && selected.state === "calibration" && (
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Advance the case to <em>decision</em> (from the person's record) before
                        signing.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
