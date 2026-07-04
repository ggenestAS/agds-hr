import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { PeerKind, PeerRequestStatus } from "@agds-hr/people/types";

import { StackedRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { PeerCaseView, PeerPageView, PeerApproverKind } from "../server/people.shared.ts";
import { peerTabBadges } from "../server/people.shared.ts";
import {
  peerApproveFn,
  peerPageFn,
  peerProposeFn,
  peerRejectFn,
  peerReopenFn,
  peerRequestCreateFn,
} from "../server/people.functions.ts";

// Peer input (improve-ux plan). Staff: answer requests addressed to you (each
// on its own focused page), and propose your own reviewers while your manager
// hasn't set the list. Managers: work each report's case — approve/reject
// proposals, add reviewers (Own team vs Cross-team auto-classified from the
// org graph), watch the quota fill, reopen submitted input.
export const Route = createFileRoute("/_app/peer-input")({
  loader: () => peerPageFn(),
  pendingComponent: () => <StackedRoutePending width="4xl" />,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="font-display text-2xl font-medium tracking-tight">Peer input</h1>
      <p className="mt-3 text-sm text-[var(--color-accent-tint-text)]">
        This page could not load. Try refreshing; if it persists, the directory service may be
        unreachable.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: PeerInputPage,
});

const KIND_LABEL: Record<PeerKind, string> = {
  lt: "LT peer",
  team: "Own team",
  cross: "Cross-team",
};

const STATUS_META: Record<PeerRequestStatus, { label: string; dot: string; pill: string }> = {
  pending: {
    label: "awaiting answer",
    dot: "bg-[var(--color-warning)]",
    pill: "bg-bone text-ink-500",
  },
  submitted: {
    label: "submitted",
    dot: "bg-[var(--color-success)]",
    pill: "bg-[var(--color-success-surface)] text-[var(--color-success)]",
  },
  declined: {
    label: "declined",
    dot: "bg-[var(--color-accent)]",
    pill: "bg-[var(--color-blush)] text-[var(--color-accent-tint-text)]",
  },
  proposed: {
    label: "awaiting approval",
    dot: "bg-ink-300",
    pill: "bg-[var(--color-warning-surface)] text-[var(--color-warning)]",
  },
};

const inputCls =
  "block w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[rgba(233,75,60,0.12)]";

const initials = (name: string): string =>
  name
    .split(/[\s.@_-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const approverPhrase = (kind: PeerApproverKind): string =>
  kind === "manager" ? "your manager" : "a co-founder";

function StatusPill({
  status,
  approverKind,
}: {
  status: PeerRequestStatus;
  approverKind?: PeerApproverKind;
}) {
  const meta = STATUS_META[status];
  const label =
    status === "proposed" && approverKind === "co_founder"
      ? "awaiting co-founder approval"
      : meta.label;
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.pill}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {label}
    </span>
  );
}

function Avatar({ name, size = 9 }: { name: string; size?: 8 | 9 }) {
  return (
    <span
      className={`flex ${size === 9 ? "size-9 text-[12px]" : "size-8 text-[11px]"} shrink-0 items-center justify-center rounded-full bg-ink-100 font-bold text-foreground`}
    >
      {initials(name)}
    </span>
  );
}

// Segmented progress toward the per-kind quota: one segment per required
// submission, filled as they land.
function QuotaBar({ caseView }: { caseView: PeerCaseView }) {
  const entries = Object.entries(caseView.quota) as [PeerKind, number][];
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {entries.map(([kind, needed]) => {
        const submitted = caseView.requests.filter(
          (request) => request.kind === kind && request.status === "submitted",
        ).length;
        return (
          <div key={kind} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{KIND_LABEL[kind]}</span>
            <span className="flex gap-1">
              {Array.from({ length: needed }, (_, index) => (
                <span
                  key={index}
                  className={`h-2 w-6 rounded-full ${index < submitted ? "bg-[var(--color-success)]" : "bg-bone"}`}
                />
              ))}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.min(submitted, needed)}/{needed}
            </span>
          </div>
        );
      })}
      <span
        className={
          caseView.quotaMet
            ? "rounded-full bg-[var(--color-success-surface)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-success)]"
            : "text-xs text-muted-foreground"
        }
      >
        {caseView.quotaMet ? "All input received ✓" : "the assessment opens once all input is in"}
      </span>
    </div>
  );
}

// One-step add composer: picking a colleague auto-classifies Own team vs
// Cross-team from the org graph (overridable); Add sends immediately.
function AddPeerComposer({
  directory,
  excludeEmails,
  teamEmails,
  actionLabel,
  busy,
  onAdd,
}: {
  directory: PeerPageView["directory"];
  excludeEmails: readonly string[];
  teamEmails: readonly string[];
  actionLabel: string;
  busy: boolean;
  onAdd: (email: string, kind: PeerKind) => void;
}) {
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<PeerKind>("cross");
  const [kindTouched, setKindTouched] = useState(false);
  const teamSet = new Set(teamEmails);

  const pick = (value: string) => {
    setEmail(value);
    if (!kindTouched && value !== "") {
      setKind(teamSet.has(value) ? "team" : "cross");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs">
          <span className="mb-1 block font-semibold text-foreground">Colleague</span>
          <select value={email} onChange={(event) => pick(event.target.value)} className={inputCls}>
            <option value="">Choose…</option>
            {directory
              .filter((person) => !excludeEmails.includes(person.email))
              .map((person) => (
                <option key={person.email} value={person.email}>
                  {person.name}
                  {person.title !== undefined ? ` — ${person.title}` : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold text-foreground">Kind</span>
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as PeerKind);
              setKindTouched(true);
            }}
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
          disabled={busy || email === ""}
          onClick={() => {
            onAdd(email, kind);
            setEmail("");
            setKindTouched(false);
          }}
        >
          {actionLabel}
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Own team = shares the local manager (pre-filled from the org chart — override if needed).
      </p>
    </div>
  );
}

type PeerTab = "mine" | "give" | "team";

const TAB_LABEL: Record<PeerTab, string> = {
  mine: "My reviewers",
  give: "Reviews I give",
  team: "My team",
};

function PeerInputPage() {
  const data: PeerPageView = Route.useLoaderData();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const visibleForYou = data.requestsForYou.filter((request) => request.status !== "proposed");
  const pendingForYou = visibleForYou.filter((request) => request.status === "pending");
  const answeredForYou = visibleForYou.filter((request) => request.status === "submitted");
  const tabBadge = peerTabBadges(data);
  const teamProposals = tabBadge.team;

  // Land where the work is: unanswered requests first, then team proposals
  // awaiting your call, otherwise your own reviewers.
  const [tab, setTab] = useState<PeerTab>(() =>
    pendingForYou.length > 0 ? "give" : data.isReviewer && teamProposals > 0 ? "team" : "mine",
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

  // Direct reports first: they are this manager's call; indirect ones are
  // normally handled by the direct manager (same split as the assessment page).
  const directCases = data.cases.filter((entry) => entry.direct);
  const indirectCases = data.cases.filter((entry) => !entry.direct);
  const selectedCase =
    data.cases.find((entry) => entry.caseId === selectedCaseId) ?? directCases[0] ?? data.cases[0];
  const tabs: readonly PeerTab[] = data.isReviewer ? ["mine", "give", "team"] : ["mine", "give"];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Review cycle
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Peer input</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground">
        Peer input is <strong>named</strong>, never anonymous — and it is never shown to the person
        it describes. You can suggest who reviews you; {approverPhrase(data.myCase.approverKind)}{" "}
        makes the final call.
      </p>

      {/* tabs */}
      <div className="mb-6 mt-5 flex gap-6 border-b border-border">
        {tabs.map((entry) => (
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
            {tabBadge[entry] > 0 && (
              <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {tabBadge[entry]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---- My reviewers: the viewer's own case ---- */}
      {tab === "mine" && (
        <Card>
          <CardHeader>
            <CardTitle>Who reviews you</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.myCase.canPropose
                ? `Suggest colleagues who saw your work firsthand — ${approverPhrase(data.myCase.approverKind)} approves the final list.`
                : "Where each of your reviewers stands. Their input is never shown to you."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!data.myCase.inReviewCycle ? (
              <p className="text-muted-foreground">You are not in the review cycle.</p>
            ) : (
              <>
                {data.myCase.pendingProposals > 0 && data.myCase.approverKind === "co_founder" && (
                  <p className="rounded-[10px] bg-[var(--color-warning-surface)] px-3 py-2 text-xs text-[var(--color-warning)]">
                    {data.myCase.pendingProposals === 1
                      ? "One proposal is waiting for a co-founder to approve it on the My team tab — you cannot approve your own reviewers."
                      : `${data.myCase.pendingProposals} proposals are waiting for a co-founder to approve them on the My team tab — you cannot approve your own reviewers.`}
                  </p>
                )}
                {data.myCase.requests.length > 0 && (
                  <div className="divide-y divide-border">
                    {data.myCase.requests.map((request) => (
                      <div key={request.requesteeEmail} className="flex items-center gap-3 py-2.5">
                        <Avatar name={request.requesteeName ?? request.requesteeEmail} size={8} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">
                            {request.requesteeName ?? request.requesteeEmail}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {KIND_LABEL[request.kind]}
                          </span>
                        </span>
                        <StatusPill
                          status={request.status}
                          approverKind={data.myCase.approverKind}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {data.myCase.canPropose && (
                  <div
                    className={data.myCase.requests.length > 0 ? "border-t border-border pt-4" : ""}
                  >
                    <AddPeerComposer
                      directory={data.directory}
                      excludeEmails={data.myCase.requests.map((request) => request.requesteeEmail)}
                      teamEmails={data.myCase.teamEmails}
                      actionLabel="Propose"
                      busy={busy}
                      onAdd={(email, kind) => {
                        void run(() => peerProposeFn({ data: { requests: [{ email, kind }] } }));
                      }}
                    />
                  </div>
                )}

                {!data.myCase.canPropose && data.myCase.requests.length === 0 && (
                  <p className="text-muted-foreground">
                    No peer reviews about you yet
                    {data.myCase.hasManagerSet
                      ? ""
                      : ` — ${approverPhrase(data.myCase.approverKind)} sets the list`}
                    .
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Reviews I give: requests addressed to the viewer ---- */}
      {tab === "give" && (
        <Card className={pendingForYou.length > 0 ? "border-[var(--color-accent)]/40" : ""}>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle>Your input on colleagues</CardTitle>
              {visibleForYou.length > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pendingForYou.length} to answer · {answeredForYou.length} submitted
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              About 10 minutes each. Visible to the reviewer and the founders — never to the person
              it describes.
            </p>
          </CardHeader>
          <CardContent className="text-sm">
            {visibleForYou.length === 0 ? (
              <p className="text-muted-foreground">
                No peer-input requests right now. When a manager names you as a reviewer, the
                request lands here.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {visibleForYou.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 py-3">
                    <Avatar name={request.subjectName ?? request.subjectEmail} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {request.subjectName ?? request.subjectEmail}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {request.subjectTitle !== undefined && `${request.subjectTitle} · `}
                        you as {KIND_LABEL[request.kind]}
                        {request.status === "declined" &&
                          request.declineReason !== undefined &&
                          ` · declined — ${request.declineReason}`}
                        {request.status === "submitted" &&
                          request.submittedAt !== undefined &&
                          ` · sent ${new Date(request.submittedAt).toLocaleDateString()}`}
                      </span>
                    </span>
                    {request.status === "pending" ? (
                      <Link
                        to="/peer-input/$requestId"
                        params={{ requestId: request.id }}
                        className="shrink-0 rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-dk)]"
                      >
                        Answer →
                      </Link>
                    ) : (
                      <StatusPill status={request.status} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- My team: the reviewer panel ---- */}
      {tab === "team" && data.isReviewer && (
        <Card>
          <CardHeader>
            <CardTitle>Your reports' peer reviews</CardTitle>
            <p className="text-sm text-muted-foreground">
              Approve or reject their proposals, add reviewers who saw the work firsthand, and watch
              the quota fill.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {data.cases.length === 0 ? (
              <p className="text-muted-foreground">
                No open cases from your reports in the self-review or peer-input stages.
              </p>
            ) : (
              <>
                {(
                  [
                    ["Direct reports", directCases, undefined],
                    ["Indirect reports", indirectCases, "normally handled by their direct manager"],
                  ] as const
                ).map(([label, group, hint]) =>
                  group.length === 0 ? null : (
                    <div key={label}>
                      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                        {label}
                        {hint !== undefined && (
                          <span className="ml-1.5 font-medium normal-case tracking-normal">
                            · {hint}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.map((entry) => {
                          const proposals = entry.requests.filter(
                            (request) => request.status === "proposed",
                          ).length;
                          const active = entry.caseId === selectedCase?.caseId;
                          return (
                            <button
                              key={entry.caseId}
                              type="button"
                              onClick={() => setSelectedCaseId(entry.caseId)}
                              className={
                                active
                                  ? "flex items-center gap-2 rounded-full border border-foreground bg-foreground py-1 pl-1 pr-3.5 text-xs font-semibold text-background"
                                  : "flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3.5 text-xs font-semibold text-foreground hover:border-ink-500"
                              }
                            >
                              <span
                                className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                  active
                                    ? "bg-background/25 text-background"
                                    : "bg-ink-100 text-foreground"
                                }`}
                              >
                                {initials(entry.subjectName ?? entry.subjectEmail)}
                              </span>
                              {entry.subjectName ?? entry.subjectEmail}
                              {entry.quotaMet && (
                                <span className="text-[var(--color-success)]">✓</span>
                              )}
                              {proposals > 0 && (
                                <span className="rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold text-white">
                                  {proposals}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )}

                {selectedCase !== undefined && (
                  <>
                    {!selectedCase.direct && (
                      <p className="rounded-[10px] bg-[var(--color-blush)] px-3 py-2 text-xs text-[var(--color-accent-tint-text)]">
                        Indirect report — you can act here, but their direct manager normally owns
                        the reviewer list.
                      </p>
                    )}
                    <div className="rounded-[14px] bg-cream px-4 py-3.5">
                      <QuotaBar caseView={selectedCase} />
                    </div>

                    {selectedCase.requests.length > 0 && (
                      <div className="divide-y divide-border">
                        {selectedCase.requests.map((request) => (
                          <div key={request.id} className="flex items-center gap-3 py-2.5">
                            <Avatar
                              name={request.requesteeName ?? request.requesteeEmail}
                              size={8}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold">
                                {request.requesteeName ?? request.requesteeEmail}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {KIND_LABEL[request.kind]}
                                {request.status === "declined" &&
                                  request.declineReason !== undefined &&
                                  ` · ${request.declineReason}`}
                              </span>
                            </span>
                            {request.status === "proposed" ? (
                              <span className="flex shrink-0 gap-1.5">
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
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  title="Remove this proposal — the person can suggest someone else"
                                  onClick={() => {
                                    void run(() =>
                                      peerRejectFn({ data: { requestId: request.id } }),
                                    );
                                  }}
                                >
                                  Reject
                                </Button>
                              </span>
                            ) : (
                              <span className="flex shrink-0 items-center gap-1.5">
                                <StatusPill status={request.status} />
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
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border pt-4">
                      <AddPeerComposer
                        directory={data.directory.filter(
                          (person) => person.email !== selectedCase.subjectEmail.toLowerCase(),
                        )}
                        excludeEmails={selectedCase.requests.map(
                          (request) => request.requesteeEmail,
                        )}
                        teamEmails={selectedCase.teamEmails}
                        actionLabel="Request"
                        busy={busy}
                        onAdd={(email, kind) => {
                          const caseId = selectedCase.caseId;
                          void run(() =>
                            peerRequestCreateFn({
                              data: { caseId, requests: [{ email, kind }] },
                            }),
                          );
                        }}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
