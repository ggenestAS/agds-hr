import { createFileRoute } from "@tanstack/react-router";

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
const RATING_LABEL: Record<(typeof RATINGS)[number], string> = {
  1: "Below",
  2: "Developing",
  3: "Strong",
  4: "Exceptional",
};

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
