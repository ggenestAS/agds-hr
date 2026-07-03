import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EVALUATION_DIMENSIONS, EVALUATION_DIMENSION_LABELS } from "@agds-hr/people/types";
import type { EvaluationDimension, PeerKind } from "@agds-hr/people/types";

import { FormRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import type { PeerAnswerView } from "../server/people.shared.ts";
import { peerAnswerFn, peerDeclineFn, peerSubmitFn } from "../server/people.functions.ts";

// The dedicated peer-input answer page (improve-ux plan): same best practice
// as the self-review form — a focused page, local draft autosave, explicit
// submit. Requestee-only. Once submitted it locks for the author; the
// subject's manager can reopen it from /peer-input.
export const Route = createFileRoute("/_app/peer-input_/$requestId")({
  loader: ({ params }) => peerAnswerFn({ data: params.requestId }),
  pendingComponent: () => <FormRoutePending width="3xl" />,
  component: PeerAnswerPage,
});

const KIND_LABEL: Record<PeerKind, string> = {
  lt: "LT peer",
  team: "Own team",
  cross: "Cross-team",
};

const DIMENSION_HINTS: Record<EvaluationDimension, string> = {
  impact: "What changed because of their work? Concrete outcomes beat adjectives.",
  ownership: "Did they close ambiguity or pass it on? A specific moment helps.",
  quality: "Would you re-check their work? Why / why not?",
  collaboration: "What is it like to work with them across teams?",
  culture: "Judgment, directness, how they represent Albert.",
};

type FormState = Partial<Record<EvaluationDimension, string>>;

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";

function PeerAnswerPage() {
  const view: PeerAnswerView = Route.useLoaderData();
  const router = useRouter();
  const storageKey = `agds_peer_input_${view.requestId}`;
  const [form, setForm] = useState<FormState>(() => ({ ...view.input }));
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submitted = view.status === "submitted";
  const answerable = view.status === "pending";

  // Local draft autosave, merged under any server copy (reopened requests keep
  // their submitted content server-side).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const local = JSON.parse(raw) as FormState;
        setForm((prev) => ({ ...local, ...prev }));
      }
    } catch {
      // ignore unreadable local drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: EvaluationDimension, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable — submit still works
      }
      return next;
    });
  };

  const filled = useMemo(
    () =>
      EVALUATION_DIMENSIONS.filter((dimension) => (form[dimension] ?? "").trim().length > 0).length,
    [form],
  );

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      await peerSubmitFn({
        data: {
          requestId: view.requestId,
          input: Object.fromEntries(
            Object.entries(form).filter(([, value]) => (value ?? "").trim().length > 0),
          ),
        },
      });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // best effort
      }
    });

  const decline = () =>
    run(() => peerDeclineFn({ data: { requestId: view.requestId, reason: declineReason.trim() } }));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/peer-input" className="text-sm text-muted-foreground hover:text-foreground">
        ← Peer input
      </Link>

      <div className="mt-4 rounded-[20px] bg-ink-900 p-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
          Peer input · {KIND_LABEL[view.kind]}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
          Your input on {view.subjectName ?? view.subjectEmail}
        </h1>
        {view.subjectTitle !== undefined && (
          <p className="mt-1 text-sm text-white/70">{view.subjectTitle}</p>
        )}
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/80">
          Five dimensions, free text — about 10 minutes. Specific moments beat general praise. Your
          input is visible to the reviewer and the founders, never to{" "}
          {view.subjectName?.split(" ")[0] ?? "the person"} themselves.
        </p>
        <div className="mt-4 rounded-[14px] border-l-2 border-[var(--color-accent)] bg-white/5 px-4 py-3 text-[13.5px] leading-relaxed text-white/85">
          <strong className="text-white">Signed as you — no anonymous input.</strong> Declines are
          allowed but logged with a reason.
        </div>
      </div>

      {submitted && (
        <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-border bg-cream px-5 py-4 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">
            ✓
          </span>
          <span>
            Submitted
            {view.submittedAt !== undefined &&
              ` on ${new Date(view.submittedAt).toLocaleDateString()}`}
            . You can't reopen it yourself — {view.subjectName?.split(" ")[0] ?? "the subject"}'s
            manager can, from the peer-input page.
          </span>
        </div>
      )}
      {view.status === "declined" && (
        <div className="mt-4 rounded-[14px] border border-border bg-cream px-5 py-4 text-sm text-muted-foreground">
          You declined this request.
        </div>
      )}

      <div className="sticky top-2 z-10 mt-4 flex items-center gap-4 rounded-[14px] border border-border bg-card px-5 py-3.5 shadow-[var(--shadow-soft)]">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between gap-3 whitespace-nowrap text-xs">
            <span className="font-semibold tabular-nums">
              {filled}/{EVALUATION_DIMENSIONS.length} dimensions
            </span>
            <span className="text-muted-foreground">
              {answerable ? "Drafts autosave locally" : "Read-only"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bone">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${Math.round((filled / EVALUATION_DIMENSIONS.length) * 100)}%` }}
            />
          </div>
        </div>
        {answerable && (
          <Button
            type="button"
            size="sm"
            disabled={busy || filled === 0}
            onClick={() => void submit()}
          >
            Submit input →
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {EVALUATION_DIMENSIONS.map((dimension) => (
          <div
            key={dimension}
            className="rounded-[14px] border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          >
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              {EVALUATION_DIMENSION_LABELS[dimension]}
              {(form[dimension] ?? "").trim().length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-[#e4f1e9] text-[10px] font-bold normal-case tracking-normal text-[#1e7a46]">
                  ✓
                </span>
              )}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">{DIMENSION_HINTS[dimension]}</p>
            <textarea
              rows={3}
              maxLength={4000}
              value={form[dimension] ?? ""}
              disabled={!answerable}
              onChange={(event) => setField(dimension, event.target.value)}
              placeholder="…"
              className={inputCls}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 pb-8">
        {answerable ? (
          <>
            {declining ? (
              <span className="flex min-w-0 flex-1 items-end gap-2">
                <label className="min-w-0 flex-1 text-xs">
                  <span className="mb-1 block font-semibold text-ink-700">
                    Declines are logged with a reason
                  </span>
                  <input
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="e.g. insufficient overlap this year"
                    maxLength={1000}
                    className={inputCls}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || declineReason.trim().length === 0}
                  onClick={() => void decline()}
                >
                  Decline
                </Button>
              </span>
            ) : (
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                onClick={() => setDeclining(true)}
              >
                Can't review this person? Decline instead
              </button>
            )}
            <Button type="button" disabled={busy || filled === 0} onClick={() => void submit()}>
              Submit input →
            </Button>
          </>
        ) : (
          <Link to="/peer-input" className="text-sm font-medium hover:text-[var(--color-accent)]">
            ← Back to peer input
          </Link>
        )}
      </div>
    </div>
  );
}
