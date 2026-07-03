import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReviewState } from "@agds-hr/people/types";

import { TwoColumnRoutePending } from "../components/route-pending/shapes.tsx";
import { PolicyArticle } from "../components/policy-article.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { OverviewData } from "../server/people.shared.ts";
import { overviewFn } from "../server/people.functions.ts";

// The Overview surface (design): the cycle at a glance. Reviewers see the scoped
// needs-a-decision list; everyone sees the cycle timeline and their own review status.
export const Route = createFileRoute("/_app/dashboard")({
  loader: () => overviewFn(),
  pendingComponent: () => <TwoColumnRoutePending width="5xl" />,
  component: Overview,
});

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

// The viewer's own case status, compact enough to sit beside the page title.
function MyReviewStatus({ myCase }: { myCase: OverviewData["myCase"] }) {
  if (myCase === undefined) {
    return <p className="text-sm text-muted-foreground">Your case has not been opened yet.</p>;
  }
  if (myCase.decidedAt !== undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Your review{" "}
        <span className="rounded-full bg-[var(--color-success-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]">
          decided
        </span>{" "}
        on {new Date(myCase.decidedAt).toLocaleDateString()}
        {myCase.appealUntil !== undefined &&
          ` · appeal window until ${new Date(myCase.appealUntil).toLocaleDateString()}`}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Your review is at{" "}
      <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
        {myCase.state.replace(/_/g, " ")}
      </span>
    </p>
  );
}

function Overview() {
  const data: OverviewData = Route.useLoaderData();
  const activeStep = data.myCase === undefined ? 2 : STATE_STEP[data.myCase.state];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Cycle {data.cycle}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Overview</h1>
        </div>
        <MyReviewStatus myCase={data.myCase} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>The {data.cycle} cycle</CardTitle>
          <p className="text-sm text-muted-foreground">
            Budget constraints set in June, before reviews begin · calibration before outcomes are
            communicated · one annual review in July–August · effective September · mid-year
            check-in in January–February.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-10 sm:grid-cols-2">
            {[CYCLE_STEPS.slice(0, 4), CYCLE_STEPS.slice(4)].map((column, columnIndex) => (
              <ol key={columnIndex}>
                {column.map((step, stepIndex) => {
                  const index = columnIndex === 0 ? stepIndex : stepIndex + 4;
                  const state =
                    index < activeStep ? "done" : index === activeStep ? "active" : "todo";
                  return (
                    <li key={step.title} className="flex items-start gap-4">
                      <span className="flex flex-col items-center self-stretch">
                        <span
                          className={
                            state === "done"
                              ? "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-info)] bg-[var(--color-info)] text-[11px] font-bold text-white"
                              : state === "active"
                                ? "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-accent)] text-[11px] font-bold text-white"
                                : "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-100 bg-bone text-[11px] font-bold text-ink-300"
                          }
                        >
                          {state === "done" ? "✓" : index + 1}
                        </span>
                        {stepIndex < column.length - 1 && (
                          <span
                            className="w-0.5 flex-1 bg-[var(--color-divider-soft)]"
                            style={{ minHeight: "22px" }}
                          />
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
            ))}
          </div>
        </CardContent>
      </Card>

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

      <div className="mt-5">
        <PolicyArticle />
      </div>
    </div>
  );
}
