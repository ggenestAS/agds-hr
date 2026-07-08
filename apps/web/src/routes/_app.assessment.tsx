import { createFileRoute, Link } from "@tanstack/react-router";

import { TwoColumnRoutePending } from "../components/route-pending/shapes.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import type { AssessReportRow } from "../server/people.shared.ts";
import { assessListFn } from "../server/people.functions.ts";

// The manager assessment list (improve-ux plan): your reports — direct
// (either line) first, then indirect — with review-readiness status. Starting
// or viewing an assessment opens the dedicated /assessment/$caseId page.
export const Route = createFileRoute("/_app/assessment")({
  loader: () => assessListFn(),
  pendingComponent: () => <TwoColumnRoutePending width="5xl" />,
  component: AssessmentPage,
});

function assessmentWaitMessage(row: AssessReportRow): string {
  if (row.caseId === undefined) {
    return "review case not opened yet";
  }
  const parts: string[] = [];
  if (!row.selfSubmitted) {
    parts.push("waiting for self-review");
  }
  if (row.peersPending > 0) {
    parts.push(
      row.peersPending === 1
        ? "waiting for peer reviews"
        : `waiting for peer reviews (${row.peersPending} pending)`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "evidence collection in progress";
}

function AssessmentPage() {
  const reports: readonly AssessReportRow[] = Route.useLoaderData();
  const direct = reports.filter((row) => row.direct);
  const indirect = reports.filter((row) => !row.direct);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Review cycle
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Assessment</h1>

      <div className="mt-4 rounded-[14px] border border-border bg-cream px-4 py-3.5 text-sm">
        <p className="font-semibold">Assessment opens after input is in</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Self-review and peer input are the evidence you build on — not optional context. You can
          start an assessment once the employee has submitted their self-review and every peer
          request is answered.
        </p>
      </div>

      {(
        [
          { rows: direct, label: "Direct reports", note: "local or functional line" },
          {
            rows: indirect,
            label: "Indirect reports",
            note: "assessments here are normally written by the direct manager",
          },
        ] as const
      ).map((group) =>
        group.rows.length === 0 ? null : (
          <Card key={group.label} className="mt-5 overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-border bg-cream px-6 py-3">
              <span className="font-display text-base font-semibold">{group.label}</span>
              <span className="text-xs text-muted-foreground">{group.note}</span>
            </div>
            <div className="divide-y divide-border">
              {group.rows.map((row) => (
                <div key={row.email} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <span className="min-w-0 flex-1">
                    {row.userId !== undefined ? (
                      <Link
                        to="/people/$userId"
                        params={{ userId: row.userId }}
                        className="block truncate text-[13.5px] font-semibold hover:text-[var(--color-accent)]"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="block truncate text-[13.5px] font-semibold">{row.name}</span>
                    )}
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.title ?? row.email}
                    </span>
                  </span>

                  {!row.inReviewCycle ? (
                    <span className="text-xs text-muted-foreground">not in the review cycle</span>
                  ) : (
                    <>
                      <span className="flex shrink-0 gap-1.5 text-[10.5px] font-bold">
                        <span
                          className={
                            row.selfSubmitted
                              ? "rounded-full bg-[var(--color-success-surface)] px-2 py-0.5 text-[var(--color-success)]"
                              : "rounded-full bg-bone px-2 py-0.5 text-ink-500"
                          }
                        >
                          self {row.selfSubmitted ? "✓" : "…"}
                        </span>
                        <span
                          className={
                            row.peersPending === 0 && row.caseId !== undefined
                              ? "rounded-full bg-[var(--color-success-surface)] px-2 py-0.5 text-[var(--color-success)]"
                              : "rounded-full bg-bone px-2 py-0.5 text-ink-500"
                          }
                        >
                          peers {row.peersSubmitted}✓
                          {row.peersPending > 0 && ` ${row.peersPending} open`}
                        </span>
                      </span>
                      {row.assessmentSubmitted && row.caseId !== undefined ? (
                        <Link to="/assessment/$caseId" params={{ caseId: row.caseId }}>
                          <Button type="button" size="sm" variant="secondary">
                            View assessment
                          </Button>
                        </Link>
                      ) : row.ready && row.caseId !== undefined ? (
                        <Link to="/assessment/$caseId" params={{ caseId: row.caseId }}>
                          <Button type="button" size="sm">
                            Start assessment
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {assessmentWaitMessage(row)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ),
      )}

      {reports.length === 0 && (
        <Card className="mt-5">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reports found on either reporting line.
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-[rgba(233,75,60,0.28)] bg-[var(--color-accent-tint-surface)] px-4 py-3.5">
        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-bold text-white">
          !
        </span>
        <div>
          <p className="text-[13.5px] font-bold text-[var(--color-accent-tint-text)]">
            Assessments must be evidence-based; vague impressions are not sufficient.
          </p>
          <p className="text-xs text-muted-foreground">
            Every dimension needs a narrative and at least one linked piece of evidence. Submission
            is blocked while any evidence field is empty.
          </p>
        </div>
      </div>
    </div>
  );
}
