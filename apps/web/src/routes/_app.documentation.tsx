import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { REVIEW_RATING_LABELS, isReviewRating } from "@agds-hr/people/types";

import { StackedRoutePending } from "../components/route-pending/shapes.tsx";
import { Card } from "../components/ui/card.tsx";
import type { DecisionDoc } from "../server/people.shared.ts";
import { decisionsFn } from "../server/people.functions.ts";

// The Documentation surface (design): every compensation decision documented —
// rating, decision, rationale — for fairness, memory, and discipline. Opening
// this page is itself an audited comp read (fail-closed in the DAL).
export const Route = createFileRoute("/_app/documentation")({
  loader: () => decisionsFn(),
  pendingComponent: () => <StackedRoutePending width="4xl" />,
  component: Documentation,
});

const FILTERS = ["All", "Merit", "Bonus", "Promotion-scale raise", "No raise"] as const;
type Filter = (typeof FILTERS)[number];

function Documentation() {
  const decisions: readonly DecisionDoc[] = Route.useLoaderData();
  const [filter, setFilter] = useState<Filter>("All");

  const visible = filter === "All" ? decisions : decisions.filter((doc) => doc.tag === filter);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Governance
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Documentation</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">
        Every compensation decision on record — role, level, band, rating, outcome, rationale, and
        any exception. Note that opening this page is itself recorded in the audit log.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setFilter(entry)}
            className={
              filter === entry
                ? "rounded-full border border-ink-900 bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:border-ink-500"
            }
          >
            {entry === "Promotion-scale raise"
              ? "Large raises"
              : entry === "All"
                ? "All"
                : `${entry}s`}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {visible.length === 0 ? (
          <Card>
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {decisions.length === 0
                ? "No decisions have been delivered this cycle yet. Documented decisions appear here once both founders sign off."
                : "No decisions match this filter."}
            </p>
          </Card>
        ) : (
          visible.map((doc) => (
            <Card key={doc.caseId} className="flex items-start gap-5 p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  {doc.userId !== undefined ? (
                    <Link
                      to="/people/$userId"
                      params={{ userId: doc.userId }}
                      className="text-sm font-bold hover:text-[var(--color-accent)]"
                    >
                      {doc.name ?? doc.subjectEmail}
                    </Link>
                  ) : (
                    <span className="text-sm font-bold">{doc.name ?? doc.subjectEmail}</span>
                  )}
                  <span className="rounded-full bg-bone px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    {doc.tag}
                  </span>
                  {doc.rating !== undefined && isReviewRating(doc.rating) && (
                    <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-dk)]">
                      {REVIEW_RATING_LABELS[doc.rating]}
                    </span>
                  )}
                </div>
                <p className="text-[13.5px] leading-relaxed text-foreground">
                  {doc.rationale ??
                    "No rationale recorded — a documented decision requires one before the annual audit."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Delivered {new Date(doc.decidedAt).toLocaleDateString()} · signed off by both
                  founders
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-base font-semibold tabular-nums">
                  {doc.amount}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {doc.effectiveDate ?? "effective Sep"}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
