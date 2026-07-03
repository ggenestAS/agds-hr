import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { PeerKind } from "@agds-hr/people/types";

import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { PeerPageView } from "../server/people.shared.ts";
import {
  peerApproveFn,
  peerPageFn,
  peerProposeFn,
  peerReopenFn,
  peerRequestCreateFn,
} from "../server/people.functions.ts";

// Peer input (improve-ux plan). Staff: propose your own peer reviewers while
// your manager hasn't set them; once set, watch statuses only. Answering a
// request happens on its own page (like the self-review form). Submitted input
// is locked for its author — only the SUBJECT'S manager can reopen it.
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
  proposed: "bg-[var(--color-warning-surface)] text-[var(--color-warning)]",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "pending",
  submitted: "submitted",
  declined: "declined",
  proposed: "awaiting manager approval",
};

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";

function PeerInputPage() {
  const data: PeerPageView = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Own-case propose state
  const [proposeStaged, setProposeStaged] = useState<readonly { email: string; kind: PeerKind }[]>(
    [],
  );
  const [proposeEmail, setProposeEmail] = useState("");
  const [proposeKind, setProposeKind] = useState<PeerKind>("team");

  // Reviewer state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [staged, setStaged] = useState<readonly { email: string; kind: PeerKind }[]>([]);
  const [pickEmail, setPickEmail] = useState("");
  const [pickKind, setPickKind] = useState<PeerKind>("team");

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

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Named input · P3
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Peer input</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-700">
        All input is <strong>named</strong> — never anonymous, never shown to the person being
        reviewed. You can suggest who reviews you; your manager decides. A case cannot advance to
        the manager assessment until the peer quota is met.
      </p>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col gap-5">
          {/* Requests addressed to the viewer */}
          <Card>
            <CardHeader>
              <CardTitle>Requests for you</CardTitle>
              <p className="text-sm text-muted-foreground">
                About 10 minutes each. Your input is visible to the reviewer and the founders —
                never to the person it describes.
              </p>
            </CardHeader>
            <CardContent className="text-sm">
              {data.requestsForYou.filter((request) => request.status !== "proposed").length ===
              0 ? (
                <p className="text-muted-foreground">No peer-input requests right now.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.requestsForYou
                    .filter((request) => request.status !== "proposed")
                    .map((request) => (
                      <div key={request.id} className="flex items-center gap-3 py-3">
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
                          {STATUS_LABEL[request.status]}
                        </span>
                        {request.status === "pending" && (
                          <Link
                            to="/peer-input/$requestId"
                            params={{ requestId: request.id }}
                            className="rounded-full bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-ink-700"
                          >
                            Answer →
                          </Link>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* The viewer's own case: propose or watch */}
          <Card>
            <CardHeader>
              <CardTitle>Your peer reviewers</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data.myCase.canPropose
                  ? "Suggest colleagues who saw your work firsthand — your manager approves the final list."
                  : "Statuses of the peer reviews about you. Content is never shown to you."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!data.myCase.inReviewCycle ? (
                <p className="text-muted-foreground">You are not in the review cycle.</p>
              ) : (
                <>
                  {data.myCase.requests.length > 0 && (
                    <div className="divide-y divide-border">
                      {data.myCase.requests.map((request) => (
                        <div
                          key={request.requesteeEmail}
                          className="flex items-center gap-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold">
                              {request.requesteeName ?? request.requesteeEmail}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {KIND_LABEL[request.kind]}
                            </span>
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[request.status]}`}
                          >
                            {STATUS_LABEL[request.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {data.myCase.canPropose && (
                    <div
                      className={
                        data.myCase.requests.length > 0
                          ? "space-y-3 border-t border-border pt-4"
                          : "space-y-3"
                      }
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="min-w-0 flex-1 text-xs">
                          <span className="mb-1 block font-semibold text-ink-700">Colleague</span>
                          <select
                            value={proposeEmail}
                            onChange={(event) => setProposeEmail(event.target.value)}
                            className={inputCls}
                          >
                            <option value="">Choose…</option>
                            {data.directory
                              .filter(
                                (person) =>
                                  !proposeStaged.some((entry) => entry.email === person.email) &&
                                  !data.myCase.requests.some(
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
                            value={proposeKind}
                            onChange={(event) => setProposeKind(event.target.value as PeerKind)}
                            className={inputCls}
                          >
                            <option value="team">Own team</option>
                            <option value="cross">Cross-team</option>
                            <option value="lt">LT peer</option>
                          </select>
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={proposeEmail === ""}
                          onClick={() => {
                            setProposeStaged((prev) => [
                              ...prev,
                              { email: proposeEmail, kind: proposeKind },
                            ]);
                            setProposeEmail("");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      {proposeStaged.length > 0 && (
                        <div className="space-y-1.5">
                          {proposeStaged.map((entry) => (
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
                                  setProposeStaged((prev) =>
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
                              onClick={() => {
                                void run(async () => {
                                  await peerProposeFn({ data: { requests: [...proposeStaged] } });
                                  setProposeStaged([]);
                                });
                              }}
                            >
                              Propose to manager →
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!data.myCase.canPropose && data.myCase.requests.length === 0 && (
                    <p className="text-muted-foreground">
                      No peer reviews about you yet
                      {data.myCase.hasManagerSet ? "" : " — your manager sets the list"}.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {data.isReviewer && (
          <Card>
            <CardHeader>
              <CardTitle>Request peer input</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your reports' cases. Approve their proposals or pick colleagues who saw the work
                firsthand; cross-team input is required, own-team scales with local team size.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {data.cases.length === 0 ? (
                <p className="text-muted-foreground">
                  No open cases from your reports in the self-review or peer-input stages.
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
                        {entry.requests.some((request) => request.status === "proposed") && (
                          <span className="ml-1.5 rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold text-white">
                            {
                              entry.requests.filter((request) => request.status === "proposed")
                                .length
                            }
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedCase !== undefined && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {Object.entries(selectedCase.quota).map(([kind, needed]) => {
                          const submitted = selectedCase.requests.filter(
                            (request) => request.kind === kind && request.status === "submitted",
                          ).length;
                          const ok = submitted >= (needed ?? 0);
                          return (
                            <span
                              key={kind}
                              className={
                                ok
                                  ? "rounded-full bg-[#e4f1e9] px-3 py-1 text-[11.5px] font-bold text-[#1e7a46]"
                                  : "rounded-full bg-[var(--color-blush)] px-3 py-1 text-[11.5px] font-bold text-[var(--color-accent-dk)]"
                              }
                            >
                              {KIND_LABEL[kind as PeerKind]} {submitted}/{needed}
                            </span>
                          );
                        })}
                        <span className="text-xs text-muted-foreground">
                          {selectedCase.quotaMet
                            ? "Quota met — the case may advance to assessment."
                            : "Assessment stays blocked until the quota clears."}
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

                      {selectedCase.requests.length > 0 && (
                        <div className="divide-y divide-border border-t border-border">
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
                                {STATUS_LABEL[request.status]}
                              </span>
                              {request.status === "proposed" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    void run(() =>
                                      peerApproveFn({ data: { requestId: request.id } }),
                                    );
                                  }}
                                >
                                  Approve
                                </Button>
                              )}
                              {request.status === "submitted" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  title="Reopen for the reviewer to edit — their input is kept"
                                  onClick={() => {
                                    void run(() =>
                                      peerReopenFn({ data: { requestId: request.id } }),
                                    );
                                  }}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>
                          ))}
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
                            <option value="team">Own team</option>
                            <option value="cross">Cross-team</option>
                            <option value="lt">LT peer</option>
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
                              onClick={() => {
                                const target = selectedCase;
                                void run(async () => {
                                  await peerRequestCreateFn({
                                    data: { caseId: target.caseId, requests: [...staged] },
                                  });
                                  setStaged([]);
                                });
                              }}
                            >
                              Send requests →
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
