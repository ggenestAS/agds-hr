import { createFileRoute, Link } from "@tanstack/react-router";
import { CAREER_LEVEL_META, REVIEW_RATING_LABELS, isReviewRating } from "@agds-hr/people/types";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { CalibrationSummary } from "../server/people.shared.ts";
import { calibrationFn } from "../server/people.functions.ts";

// Calibration surface (design): the rating distribution — calibrated, exceptional
// stays rare — and the cases flagged for a CEO/COO decision.
export const Route = createFileRoute("/_app/calibration")({
  loader: () => calibrationFn(),
  component: Calibration,
});

const RATINGS = [1, 2, 3, 4] as const;
const RATING_LABEL: Record<(typeof RATINGS)[number], string> = REVIEW_RATING_LABELS;

function Calibration() {
  const summary: CalibrationSummary = Route.useLoaderData();
  const peak = Math.max(1, ...RATINGS.map((rating) => summary.distribution[rating]));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Calibration
      </p>
      <div className="flex items-baseline justify-between">
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
          {summary.cycle} cycle
        </h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {summary.total} cases · {summary.unrated} unrated
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
        Compare people at the same level and similar scope. Challenge inflated or harsh ratings;
        reduce bias from visibility, tenure, or proximity to leadership. Final sign-off: CEO & COO.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rating distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4" style={{ height: "160px" }}>
            {RATINGS.map((rating) => {
              const value = summary.distribution[rating];
              return (
                <div key={rating} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-semibold tabular-nums">{value}</span>
                  <div
                    className={`w-full rounded-t-[6px] ${rating === 4 ? "bg-[var(--color-accent)]" : "bg-ink-300"}`}
                    style={{
                      height: `${(value / peak) * 120}px`,
                      minHeight: value > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {rating} · {RATING_LABEL[rating]}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {summary.groups.map((group) => (
        <Card key={group.level ?? "unassigned"} className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-cream px-6 py-3.5">
            <span className="font-display text-base font-semibold">
              {group.level !== undefined
                ? `${group.level} — ${CAREER_LEVEL_META[group.level].name}`
                : "Level unassigned"}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.people.length} {group.people.length === 1 ? "person" : "people"}
            </span>
          </div>
          {group.people.map((person) => (
            <div
              key={person.subjectEmail}
              className="flex items-center gap-4 border-b border-border px-6 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                {person.userId !== undefined ? (
                  <Link
                    to="/people/$userId"
                    params={{ userId: person.userId }}
                    className="block truncate text-[13.5px] font-semibold hover:text-[var(--color-accent)]"
                  >
                    {person.name ?? person.subjectEmail}
                  </Link>
                ) : (
                  <span className="block truncate text-[13.5px] font-semibold">
                    {person.name ?? person.subjectEmail}
                  </span>
                )}
                <span className="block truncate text-xs text-muted-foreground">
                  {person.title ?? person.subjectEmail} · {person.state.replace(/_/g, " ")}
                </span>
              </span>
              {person.rating !== undefined && isReviewRating(person.rating) ? (
                <span
                  className={
                    person.rating >= 3
                      ? "rounded-full bg-ink-900 px-2.5 py-0.5 text-[11.5px] font-bold text-white"
                      : "rounded-full bg-coral px-2.5 py-0.5 text-[11.5px] font-bold text-[#5a2018]"
                  }
                >
                  {REVIEW_RATING_LABELS[person.rating]}
                </span>
              ) : (
                <span className="rounded-full bg-bone px-2.5 py-0.5 text-[11.5px] font-bold text-ink-500">
                  In review
                </span>
              )}
            </div>
          ))}
        </Card>
      ))}

      <Card variant="warning" className="mt-4">
        <CardHeader>
          <CardTitle>Needs a decision</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {summary.needsDecision.length === 0 ? (
            <span className="text-muted-foreground">
              No cases awaiting calibration or founder sign-off.
            </span>
          ) : (
            <ul className="space-y-1">
              {summary.needsDecision.map((entry) => (
                <li key={entry.subjectEmail} className="flex items-baseline justify-between">
                  <span>{entry.subjectEmail}</span>
                  <span className="tabular-nums text-muted-foreground">
                    rating {entry.rating ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
