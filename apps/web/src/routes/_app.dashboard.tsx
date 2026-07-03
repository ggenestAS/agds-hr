import { createFileRoute, Link } from "@tanstack/react-router";
import { REVIEW_RATING_LABELS } from "@agds-hr/people/types";
import type { ReviewState } from "@agds-hr/people/types";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { OverviewData } from "../server/people.shared.ts";
import { overviewFn } from "../server/people.functions.ts";

// The Overview surface (design): the cycle at a glance. Reviewers see stat
// tiles, the calibrated rating distribution, and the needs-a-decision list;
// everyone sees the cycle timeline and their own review status.
export const Route = createFileRoute("/_app/dashboard")({
  loader: () => overviewFn(),
  component: Overview,
});

const RATINGS = [4, 3, 2, 1] as const;
const RATING_BAR: Record<(typeof RATINGS)[number], string> = {
  4: "bg-ink-900",
  3: "bg-[#1e3a8a]",
  2: "bg-coral",
  1: "bg-[var(--color-accent)]",
};

// The optimized cycle (2026-07-03): budget constraints are set BEFORE reviews
// begin, calibration happens BEFORE outcomes are communicated, and the annual
// review conversation carries the confirmed outcome plus next-year objectives.
const CYCLE_STEPS = [
  {
    title: "Mid-year check-in",
    when: "Jan–Feb",
    note: "priorities, trajectory, feedback, course correction",
  },
  {
    title: "Budget planning",
    when: "June",
    note: "compensation budget, promotion envelope, bonus pool & headcount constraints defined",
  },
  {
    title: "Self-review & peer input",
    when: "Late June",
    note: "evidence collection, not ratings",
  },
  {
    title: "Manager review preparation",
    when: "Early July",
    note: "evidence-based assessments; proposed rating / level / compensation, subject to calibration",
  },
  {
    title: "Calibration",
    when: "Early July, after manager preparation",
    note: "CEO, COO & managers align standards, ratings, levels, promotions & compensation before outcomes are communicated",
  },
  {
    title: "Annual review & objective setting",
    when: "July–August",
    note: "final feedback, confirmed rating / level, promotion if relevant, development priorities, next-year objectives & success metrics",
  },
  {
    title: "Effective date",
    when: "September",
    note: "raises, bonuses & promotions become effective",
  },
] as const;

// Where each review state sits on the personal timeline (0-based step index).
// A case in self_review/peer_input sits at step 2 (Self-review & peer input);
// decision = awaiting sign-off & communication (step 5); delivered cases point
// at the effective date.
const STATE_STEP: Record<ReviewState, number> = {
  self_review: 2,
  peer_input: 2,
  manager_assessment: 3,
  calibration: 4,
  decision: 5,
  appeal: 6,
  closed: 6,
};

function Overview() {
  const data: OverviewData = Route.useLoaderData();
  const distTotal = Math.max(
    1,
    RATINGS.reduce((sum, rating) => sum + data.distribution[rating], 0),
  );
  const activeStep = data.myCase === undefined ? 2 : STATE_STEP[data.myCase.state];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Cycle {data.cycle}
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Overview</h1>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>The {data.cycle} cycle</CardTitle>
            <p className="text-sm text-muted-foreground">
              Budget constraints set in June, before reviews begin · calibration before outcomes are
              communicated · one annual review in July–August · effective September · mid-year
              check-in in January–February.
            </p>
          </CardHeader>
          <CardContent>
            <ol>
              {CYCLE_STEPS.map((step, index) => {
                const state =
                  index < activeStep ? "done" : index === activeStep ? "active" : "todo";
                return (
                  <li key={step.title} className="flex items-start gap-4">
                    <span className="flex flex-col items-center self-stretch">
                      <span
                        className={
                          state === "done"
                            ? "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#1e3a8a] bg-[#1e3a8a] text-[11px] font-bold text-white"
                            : state === "active"
                              ? "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[11px] font-bold text-white"
                              : "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-100 bg-bone text-[11px] font-bold text-ink-300"
                        }
                      >
                        {state === "done" ? "✓" : index + 1}
                      </span>
                      {index < CYCLE_STEPS.length - 1 && (
                        <span className="w-0.5 flex-1 bg-[#e9e4da]" style={{ minHeight: "22px" }} />
                      )}
                    </span>
                    <span className="pb-4">
                      <span
                        className={
                          state === "todo"
                            ? "block text-sm font-semibold text-ink-300"
                            : "block text-sm font-semibold"
                        }
                      >
                        {step.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {step.when} · {step.note}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {data.isReviewer ? (
          <Card>
            <CardHeader>
              <CardTitle>Rating distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Calibrated ratings · Exceptional stays rare.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {RATINGS.map((rating) => {
                const count = data.distribution[rating];
                return (
                  <div key={rating}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{REVIEW_RATING_LABELS[rating]}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {count} {count === 1 ? "person" : "people"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bone">
                      <div
                        className={`h-full rounded-full ${RATING_BAR[rating]}`}
                        style={{ width: `${Math.round((count / distTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your review</CardTitle>
              <p className="text-sm text-muted-foreground">Cycle {data.cycle}</p>
            </CardHeader>
            <CardContent className="text-sm">
              {data.myCase === undefined ? (
                <span className="text-muted-foreground">
                  Your review case has not been opened yet. Your manager opens it when the cycle
                  starts.
                </span>
              ) : data.myCase.decidedAt !== undefined ? (
                <div className="space-y-2">
                  <p>
                    Your decision summary was delivered on{" "}
                    <span className="font-semibold">
                      {new Date(data.myCase.decidedAt).toLocaleDateString()}
                    </span>
                    .
                  </p>
                  {data.myCase.appealUntil !== undefined && (
                    <p className="text-muted-foreground">
                      You may appeal until{" "}
                      <span className="font-semibold text-foreground">
                        {new Date(data.myCase.appealUntil).toLocaleDateString()}
                      </span>{" "}
                      from your record page.
                    </p>
                  )}
                </div>
              ) : (
                <p>
                  Your case is at{" "}
                  <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
                    {data.myCase.state.replace(/_/g, " ")}
                  </span>
                  . The decision summary arrives after calibration and dual founder sign-off.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {data.isReviewer && (
        <Card className="mt-5" variant="warning">
          <CardHeader>
            <div className="flex items-baseline justify-between">
              <CardTitle>Needs a decision</CardTitle>
              <span className="text-xs text-muted-foreground">
                Flagged for calibration & CEO/COO sign-off
              </span>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {data.needsDecision.length === 0 ? (
              <span className="text-muted-foreground">
                No cases awaiting calibration or founder sign-off.
              </span>
            ) : (
              <ul className="divide-y divide-border">
                {data.needsDecision.map((entry) => (
                  <li key={entry.subjectEmail} className="flex items-center gap-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {entry.name ?? entry.subjectEmail}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.subjectEmail}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      rating {entry.rating ?? "—"}
                    </span>
                    {entry.userId !== undefined && (
                      <Link
                        to="/people/$userId"
                        params={{ userId: entry.userId }}
                        className="text-sm font-medium hover:text-[var(--color-accent)]"
                      >
                        Open →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
