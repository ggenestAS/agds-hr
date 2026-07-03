import { createFileRoute, useRouter } from "@tanstack/react-router";
import { APPEAL_CATEGORIES } from "@agds-hr/people/types";
import type { AppealCategory } from "@agds-hr/people/types";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import type { AppealsPageView, AppealView } from "../server/people.shared.ts";
import { appealsPageFn, fileAppealFn, resolveAppealFn } from "../server/people.functions.ts";

// The Appeals surface (design M9): anyone may appeal their own decision within
// 30 days of delivery. Appeals are visible only to Admins and the appellant —
// and are structurally excluded from any future performance view. HR Admins
// additionally see the open/resolved queue and resolve with a written response.
export const Route = createFileRoute("/_app/appeals")({
  loader: () => appealsPageFn(),
  component: Appeals,
});

const CATEGORY_LABEL: Record<AppealCategory, string> = {
  rating: "Rating",
  raise: "Raise",
  band: "Band placement",
  exception: "Exception",
};

function AppealCard({ appeal, mine }: { appeal: AppealView; mine?: boolean }) {
  return (
    <Card variant={appeal.status === "open" ? "warning" : "default"}>
      <CardContent className="pt-5 text-sm">
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-accent-dk)]">
            {CATEGORY_LABEL[appeal.category]}
          </span>
          {!mine && <span className="text-sm font-bold">{appeal.appellantEmail}</span>}
          <span className="ml-auto text-xs font-semibold text-muted-foreground">
            {appeal.status === "resolved" ? "Resolved" : "In review"} · filed{" "}
            {new Date(appeal.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed text-ink-700">{appeal.statement}</p>
        {appeal.resolution !== undefined && (
          <div className="mt-3 rounded-[10px] bg-cream px-3.5 py-2.5">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              Resolution
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{appeal.resolution}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Appeals() {
  const data: AppealsPageView = Route.useLoaderData();
  const router = useRouter();
  const [category, setCategory] = useState<AppealCategory>("rating");
  const [statement, setStatement] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const open = data.queue.filter((appeal) => appeal.status === "open");
  const resolved = data.queue.filter((appeal) => appeal.status === "resolved");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Fairness route · P4
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Appeals</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-700">
        Anyone may appeal a decision within 30 days of delivery. Appeals are visible only to HR
        Admins and the appellant — and are structurally excluded from any future performance view.
      </p>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Your appeals
          </p>
          {data.myAppeal !== undefined ? (
            <AppealCard appeal={data.myAppeal} mine />
          ) : (
            <div className="rounded-[14px] border border-dashed border-border bg-card px-6 py-8 text-center">
              <p className="text-sm font-semibold">No appeals on file</p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                If you disagree with a decision, you can appeal within 30 days of receiving your
                summary. Appeals are visible only to you and HR Admins — and are never part of any
                future review.
              </p>
            </div>
          )}

          {data.canManage && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                Open & resolved appeals · HR queue
              </p>
              {data.queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appeals have been filed.</p>
              ) : (
                <>
                  {open.map((appeal) => (
                    <div key={appeal.id}>
                      <AppealCard appeal={appeal} />
                      <div className="mt-2 space-y-2 rounded-[14px] border border-border bg-card p-4">
                        <textarea
                          value={drafts[appeal.id] ?? ""}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [appeal.id]: event.target.value }))
                          }
                          rows={2}
                          maxLength={4000}
                          placeholder="A written response is required to close…"
                          className="block w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || (drafts[appeal.id] ?? "").trim().length === 0}
                            onClick={() => {
                              const resolution = (drafts[appeal.id] ?? "").trim();
                              void run(() =>
                                resolveAppealFn({ data: { appealId: appeal.id, resolution } }),
                              );
                            }}
                          >
                            Resolve appeal
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {resolved.map((appeal) => (
                    <AppealCard key={appeal.id} appeal={appeal} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit an appeal</CardTitle>
            <p className="text-sm text-muted-foreground">
              One appeal per decision.
              {data.appealUntil !== undefined && data.canAppealNow && (
                <>
                  {" "}
                  Your window is open until{" "}
                  <strong className="text-foreground">
                    {new Date(data.appealUntil).toLocaleDateString()}
                  </strong>
                  .
                </>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!data.canAppealNow ? (
              <p className="text-muted-foreground">
                {data.myAppeal !== undefined
                  ? "You have already appealed this cycle's decision — one appeal per decision."
                  : data.myCaseId === undefined
                    ? "You can appeal once your decision summary has been delivered."
                    : data.appealUntil === undefined
                      ? "Your decision has not been delivered yet — the 30-day window opens on delivery."
                      : "Your 30-day appeal window has closed."}
              </p>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[12.5px] font-semibold text-ink-700">
                    What are you appealing?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {APPEAL_CATEGORIES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCategory(value)}
                        className={
                          category === value
                            ? "rounded-full border border-ink-900 bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                            : "rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-500"
                        }
                      >
                        {CATEGORY_LABEL[value]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[12.5px] font-semibold text-ink-700">Your statement</p>
                  <textarea
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder="Explain, with specifics, why you believe the decision should be reconsidered."
                    className="block w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <Button
                  type="button"
                  disabled={busy || statement.trim().length === 0}
                  onClick={() => {
                    const caseId = data.myCaseId;
                    if (caseId !== undefined) {
                      void run(() =>
                        fileAppealFn({
                          data: { caseId, category, statement: statement.trim() },
                        }),
                      );
                    }
                  }}
                >
                  Submit appeal →
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Routes to HR Admins. A written response is required to close.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
