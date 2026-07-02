import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { APPEAL_CATEGORIES, CAREER_LEVELS, CAREER_PATHS } from "@agds-hr/people/types";
import type { AppealCategory, CareerLevel, CareerPath, ReviewState } from "@agds-hr/people/types";
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

export const Route = createFileRoute("/_app/people/$userId")({
  loader: ({ params }) => personDetailFn({ data: params.userId }),
  component: PersonDetailPage,
});

const PATH_LABEL: Record<CareerPath, string> = { ic: "IC", manager: "Manager" };
const APPEAL_CATEGORY_LABEL: Record<AppealCategory, string> = {
  rating: "Rating",
  raise: "Raise",
  band: "Band",
  exception: "Other",
};
const STATE_LABEL: Record<ReviewState, string> = {
  self_review: "Self-review",
  peer_input: "Peer input",
  manager_assessment: "Manager assessment",
  calibration: "Calibration",
  decision: "Decision",
  appeal: "Appeal",
  closed: "Closed",
};

function PersonDetailPage() {
  const person: PersonDetail = Route.useLoaderData();
  const router = useRouter();
  const [level, setLevel] = useState<CareerLevel>(person.level ?? "L1");
  const [path, setPath] = useState<CareerPath>(person.path ?? "ic");
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

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/people" className="text-sm text-muted-foreground hover:text-foreground">
        ← All people
      </Link>

      <div className="mt-3 flex items-baseline gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">{person.name}</h1>
        {!person.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Inactive
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {person.email}
        {person.title !== undefined && ` · ${person.title}`}
        {person.campus !== undefined && ` · ${person.campus}`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job architecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-muted-foreground">
              Level · Path:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {person.level === undefined
                  ? "unassigned"
                  : `${person.level} · ${person.path === undefined ? "" : PATH_LABEL[person.path]}`}
              </span>
            </div>
            {person.canEditAttrs && (
              <div className="flex flex-wrap items-end gap-2 frm">
                <label className="text-xs">
                  Level
                  <select
                    value={level}
                    onChange={(event) => setLevel(event.target.value as CareerLevel)}
                    className="mt-1 block rounded-[10px] border border-border bg-card px-2 py-1"
                  >
                    {CAREER_LEVELS.map((value) => (
                      <option key={value} value={value}>
                        {value}
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
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    void run(() =>
                      setEmployeeAttrsFn({ data: { email: person.email, level, path } }),
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
            <CardTitle>Reports to</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {person.managers.length === 0 ? (
              <span className="text-muted-foreground">No manager on record.</span>
            ) : (
              <ol className="space-y-1">
                {person.managers.map((manager, index) => (
                  <li key={manager.userId} className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Annual review · 2026</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {person.reviewCase === undefined ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">No review case for this cycle.</span>
              {person.canReview && (
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
                  {STATE_LABEL[person.reviewCase.state]}
                </span>
                <span className="text-muted-foreground">
                  Rating:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {person.reviewCase.rating ?? "—"}
                  </span>
                </span>
                {person.reviewCase.p6Triggered && (
                  <span className="rounded-full bg-[var(--color-warning-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]">
                    P6 improvement plan
                  </span>
                )}
              </div>

              {person.reviewCase.decidedAt !== undefined ? (
                <div className="rounded-[10px] bg-cream px-3 py-2 text-sm">
                  Decision delivered {new Date(person.reviewCase.decidedAt).toLocaleDateString()} ·
                  appeal window until{" "}
                  <span className="font-semibold">
                    {person.reviewCase.appealUntil === undefined
                      ? "—"
                      : new Date(person.reviewCase.appealUntil).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                person.reviewCase.state === "decision" && (
                  <div className="flex items-center gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                      Founder sign-offs:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {person.reviewCase.signoffCount}/2
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
                          const caseId = person.reviewCase?.id;
                          if (caseId !== undefined) {
                            void run(() => signDecisionFn({ data: { caseId } }));
                          }
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
                  {person.reviewCase.nextStates.map((next) => (
                    <Button
                      key={next}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        const caseId = person.reviewCase?.id;
                        if (caseId !== undefined) {
                          void run(() => advanceReviewFn({ data: { caseId, toState: next } }));
                        }
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
                        const caseId = person.reviewCase?.id;
                        const value = Number(event.target.value);
                        if (caseId !== undefined && value >= 1 && value <= 4) {
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

      {person.reviewCase !== undefined && person.canViewComp && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Compensation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {comp === null ? (
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
                    const caseId = person.reviewCase?.id;
                    if (caseId !== undefined) {
                      setBusy(true);
                      void compFn({ data: { caseId } })
                        .then((view) => setComp(view))
                        .finally(() => setBusy(false));
                    }
                  }}
                >
                  View compensation
                </Button>
              </div>
            ) : comp.recommendation === undefined ? (
              <span className="text-muted-foreground">No compensation recommendation yet.</span>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}

      {(person.appeal !== undefined || person.canAppeal) && (
        <Card className="mt-4">
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
                  You may appeal this decision within the 30-day window. Appeals go to HR (Admins)
                  and are kept out of performance views.
                </p>
                <label className="block text-xs">
                  Category
                  <select
                    value={appealCategory}
                    onChange={(event) => setAppealCategory(event.target.value as AppealCategory)}
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
                  placeholder="Explain the grounds for your appeal…"
                  className="block w-full rounded-[10px] border border-border bg-card px-3 py-2"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || appealStatement.trim().length === 0}
                  onClick={() => {
                    const caseId = person.reviewCase?.id;
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
  );
}
