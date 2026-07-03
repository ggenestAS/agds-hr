import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { EVALUATION_DIMENSIONS, EVALUATION_DIMENSION_LABELS } from "@agds-hr/people/types";
import type { EvaluationDimension, PeerKind } from "@agds-hr/people/types";

import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { PeerPageView } from "../server/people.shared.ts";
import {
  peerDeclineFn,
  peerPageFn,
  peerRequestCreateFn,
  peerSubmitFn,
} from "../server/people.functions.ts";

// Peer input (design M5): all input is NAMED — never anonymous, never shown to
// the person being reviewed. Requestees answer five dimensions; reviewers pick
// requestees and watch the LT quota gate (2 LT + 2 own-team before the case
// may advance to assessment).
export const Route = createFileRoute("/_app/peer-input")({
  loader: () => peerPageFn(),
  component: PeerInputPage,
});

const KIND_LABEL: Record<PeerKind, string> = {
  lt: "LT peer",
  team: "Own team",
  cross: "Cross-team",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-bone text-ink-500",
  submitted: "bg-[#e4f1e9] text-[#1e7a46]",
  declined: "bg-[var(--color-blush)] text-[var(--color-accent-dk)]",
};

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";

function PeerInputPage() {
  const data: PeerPageView = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Requestee form state
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<EvaluationDimension, string>>>({});
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Reviewer state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [staged, setStaged] = useState<readonly { email: string; kind: PeerKind }[]>([]);
  const [pickEmail, setPickEmail] = useState("");
  const [pickKind, setPickKind] = useState<PeerKind>("lt");

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const selectedCase = data.cases.find((entry) => entry.caseId === selectedCaseId) ?? data.cases[0];
  const pendingForYou = data.requestsForYou.filter((request) => request.status === "pending");

  const submitInput = (requestId: string) =>
    run(async () => {
      await peerSubmitFn({
        data: {
          requestId,
          input: Object.fromEntries(
            Object.entries(answers).filter(([, value]) => (value ?? "").trim().length > 0),
          ),
        },
      });
      setAnsweringId(null);
      setAnswers({});
    });

  const decline = (requestId: string) =>
    run(async () => {
      await peerDeclineFn({ data: { requestId, reason: declineReason.trim() } });
      setDecliningId(null);
      setDeclineReason("");
    });

  const sendRequests = () => {
    const target = selectedCase;
    if (target === undefined || staged.length === 0) {
      return;
    }
    void run(async () => {
      await peerRequestCreateFn({ data: { caseId: target.caseId, requests: [...staged] } });
      setStaged([]);
    });
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Named input · P3
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Peer input</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-700">
        Peer input is a required input for leadership-team reviews. All input is{" "}
        <strong>named</strong> — never anonymous, never shown to the person being reviewed. For LT
        members a case cannot advance to the manager assessment until the quota is met.
      </p>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Requests for you</CardTitle>
            <p className="text-sm text-muted-foreground">
              About 10 minutes each. Your input is visible to the reviewer and the founders — never
              to the person it describes.
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            {data.requestsForYou.length === 0 ? (
              <p className="text-muted-foreground">No peer-input requests right now.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.requestsForYou.map((request) => (
                  <div key={request.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {request.subjectName ?? request.subjectEmail}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {KIND_LABEL[request.kind]}
                          {request.status === "declined" &&
                            request.declineReason !== undefined &&
                            ` · declined — ${request.declineReason}`}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[request.status]}`}
                      >
                        {request.status}
                      </span>
                      {request.status === "pending" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setAnsweringId(answeringId === request.id ? null : request.id);
                            setDecliningId(null);
                          }}
                        >
                          {answeringId === request.id ? "Close" : "Answer"}
                        </Button>
                      )}
                    </div>

                    {answeringId === request.id && (
                      <div className="mt-3 space-y-3 rounded-[14px] bg-cream p-4">
                        <p className="text-xs text-muted-foreground">
                          Five dimensions, free text. Specific moments beat general praise. Signed
                          as you — no anonymous input.
                        </p>
                        {EVALUATION_DIMENSIONS.map((dimension) => (
                          <div key={dimension}>
                            <label className="mb-1 block text-[12px] font-semibold text-ink-700">
                              {EVALUATION_DIMENSION_LABELS[dimension]}
                            </label>
                            <textarea
                              rows={2}
                              maxLength={4000}
                              value={answers[dimension] ?? ""}
                              onChange={(event) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [dimension]: event.target.value,
                                }))
                              }
                              className={inputCls}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
                            onClick={() => {
                              setDecliningId(request.id);
                              setAnsweringId(null);
                            }}
                          >
                            Decline instead
                          </button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              busy ||
                              Object.values(answers).every(
                                (value) => (value ?? "").trim().length === 0,
                              )
                            }
                            onClick={() => void submitInput(request.id)}
                          >
                            Submit input →
                          </Button>
                        </div>
                      </div>
                    )}

                    {decliningId === request.id && (
                      <div className="mt-3 space-y-2 rounded-[14px] bg-cream p-4">
                        <label className="block text-[12px] font-semibold text-ink-700">
                          Declines are allowed but logged with a reason
                        </label>
                        <input
                          value={declineReason}
                          onChange={(event) => setDeclineReason(event.target.value)}
                          placeholder="e.g. insufficient overlap this year"
                          maxLength={1000}
                          className={inputCls}
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || declineReason.trim().length === 0}
                            onClick={() => void decline(request.id)}
                          >
                            Decline request
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {pendingForYou.length > 0 && answeringId === null && (
              <p className="mt-3 text-xs text-muted-foreground">
                {pendingForYou.length} pending — answering takes about 10 minutes each.
              </p>
            )}
          </CardContent>
        </Card>

        {data.isReviewer && (
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Request peer input</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pick colleagues who have seen the work firsthand. For an LT member you need at
                  least <strong>2 LT peers and 2 own-team</strong> reviewers; cross-team input is
                  optional.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {data.cases.length === 0 ? (
                  <p className="text-muted-foreground">
                    No open cases in the self-review or peer-input stages.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {data.cases.map((entry) => (
                        <button
                          key={entry.caseId}
                          type="button"
                          onClick={() => setSelectedCaseId(entry.caseId)}
                          className={
                            entry.caseId === selectedCase?.caseId
                              ? "rounded-full border border-ink-900 bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                              : "rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-500"
                          }
                        >
                          {entry.subjectName ?? entry.subjectEmail}
                        </button>
                      ))}
                    </div>

                    {selectedCase !== undefined && (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          {(["lt", "team"] as const).map((kind) => {
                            const submitted = selectedCase.requests.filter(
                              (request) => request.kind === kind && request.status === "submitted",
                            ).length;
                            const ok = submitted >= 2;
                            return (
                              <span
                                key={kind}
                                className={
                                  ok
                                    ? "rounded-full bg-[#e4f1e9] px-3 py-1 text-[11.5px] font-bold text-[#1e7a46]"
                                    : "rounded-full bg-[var(--color-blush)] px-3 py-1 text-[11.5px] font-bold text-[var(--color-accent-dk)]"
                                }
                              >
                                {KIND_LABEL[kind]} {submitted}/2
                              </span>
                            );
                          })}
                          <span className="text-xs text-muted-foreground">
                            {selectedCase.quotaMet
                              ? "Quota met — the case may advance to assessment."
                              : "The state machine will not move to assessment until the quota clears."}
                          </span>
                        </div>

                        {selectedCase.peerSuggestions !== undefined && (
                          <div className="rounded-[14px] bg-cream px-4 py-3">
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                              Suggested by {selectedCase.subjectName ?? "the subject"} — you decide
                              the final list
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                              {selectedCase.peerSuggestions}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                          <label className="min-w-0 flex-1 text-xs">
                            <span className="mb-1 block font-semibold text-ink-700">Colleague</span>
                            <select
                              value={pickEmail}
                              onChange={(event) => setPickEmail(event.target.value)}
                              className={inputCls}
                            >
                              <option value="">Choose…</option>
                              {data.directory
                                .filter(
                                  (person) =>
                                    person.email !== selectedCase.subjectEmail.toLowerCase() &&
                                    !staged.some((entry) => entry.email === person.email) &&
                                    !selectedCase.requests.some(
                                      (request) => request.requesteeEmail === person.email,
                                    ),
                                )
                                .map((person) => (
                                  <option key={person.email} value={person.email}>
                                    {person.name}
                                    {person.title !== undefined ? ` — ${person.title}` : ""}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="text-xs">
                            <span className="mb-1 block font-semibold text-ink-700">Kind</span>
                            <select
                              value={pickKind}
                              onChange={(event) => setPickKind(event.target.value as PeerKind)}
                              className={inputCls}
                            >
                              <option value="lt">LT peer</option>
                              <option value="team">Own team</option>
                              <option value="cross">Cross-team</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pickEmail === ""}
                            onClick={() => {
                              setStaged((prev) => [...prev, { email: pickEmail, kind: pickKind }]);
                              setPickEmail("");
                            }}
                          >
                            Add
                          </Button>
                        </div>

                        {staged.length > 0 && (
                          <div className="space-y-1.5">
                            {staged.map((entry) => (
                              <div
                                key={entry.email}
                                className="flex items-center justify-between rounded-[10px] bg-cream px-3 py-2"
                              >
                                <span className="text-[13px] font-medium">
                                  {data.directory.find((person) => person.email === entry.email)
                                    ?.name ?? entry.email}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    · {KIND_LABEL[entry.kind]}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setStaged((prev) =>
                                      prev.filter((candidate) => candidate.email !== entry.email),
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <div className="flex justify-end pt-1">
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy}
                                onClick={sendRequests}
                              >
                                Send requests →
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedCase.requests.length > 0 && (
                          <div className="border-t border-border pt-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Requests · {selectedCase.subjectName ?? selectedCase.subjectEmail}
                            </p>
                            <div className="divide-y divide-border">
                              {selectedCase.requests.map((request) => (
                                <div key={request.id} className="flex items-center gap-3 py-2.5">
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-semibold">
                                      {request.requesteeName ?? request.requesteeEmail}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {KIND_LABEL[request.kind]}
                                      {request.status === "declined" &&
                                        request.declineReason !== undefined &&
                                        ` · ${request.declineReason}`}
                                    </span>
                                  </span>
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[request.status]}`}
                                  >
                                    {request.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {selectedCase !== undefined &&
              selectedCase.requests.some((request) => request.status === "submitted") && (
                <Card>
                  <CardHeader>
                    <div className="flex items-baseline justify-between gap-3">
                      <CardTitle>Submitted input</CardTitle>
                      <span className="shrink-0 rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent-dk)]">
                        Named · not shown to subject
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm">
                    {selectedCase.requests
                      .filter((request) => request.status === "submitted")
                      .map((request) => (
                        <div key={request.id}>
                          <p className="mb-2 text-xs font-semibold text-muted-foreground">
                            From {request.requesteeName ?? request.requesteeEmail} ·{" "}
                            {KIND_LABEL[request.kind]}
                          </p>
                          <div className="space-y-2.5">
                            {EVALUATION_DIMENSIONS.filter(
                              (dimension) => (request.input[dimension] ?? "").length > 0,
                            ).map((dimension) => (
                              <div key={dimension}>
                                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                  {EVALUATION_DIMENSION_LABELS[dimension]}
                                </p>
                                <p className="text-[13.5px] leading-relaxed text-ink-700">
                                  {request.input[dimension]}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
