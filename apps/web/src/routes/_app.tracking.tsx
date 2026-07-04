import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReviewState } from "@agds-hr/people/types";
import { z } from "zod";

import { TableRoutePending } from "../components/route-pending/shapes.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { TrackingRow, TrackingView } from "../server/people.shared.ts";
import { trackingFn } from "../server/people.functions.ts";

const trackingSearchSchema = z.object({
  reports: z.enum(["direct", "indirect"]).optional(),
});

// The Tracking board (docs/plans/notifications.md): who still has to do what,
// derived from the same computeObligations assembly the digest emails use.
// Managers see their reports; leadership sees everyone (scoped by the handler).
export const Route = createFileRoute("/_app/tracking")({
  validateSearch: trackingSearchSchema,
  loader: () => trackingFn(),
  pendingComponent: () => <TableRoutePending width="6xl" columns={6} />,
  component: Tracking,
});

const STATE_ORDER: readonly ReviewState[] = [
  "self_review",
  "peer_input",
  "manager_assessment",
  "calibration",
  "decision",
  "appeal",
  "closed",
];

// Human labels for the derived obligation kinds (people/obligations.ts).
const OBLIGATION_LABEL: Record<string, string> = {
  self_review_pending: "Self-review",
  peer_input_pending: "Peer answer",
  peer_quota_unmet: "Peer quota",
  assessment_pending: "Assessment",
  sign_off_pending: "Sign-off",
};

function filterPillClass(active: boolean): string {
  return active
    ? "rounded-full border border-foreground bg-foreground px-4 py-1.5 text-xs font-semibold text-background"
    : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:border-ink-500";
}

function filterRows(
  rows: readonly TrackingRow[],
  reports: "direct" | "indirect" | undefined,
): readonly TrackingRow[] {
  if (reports === undefined) {
    return rows;
  }
  return rows.filter((row) => row.reportLine === reports);
}

function StageDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={
        done
          ? "inline-flex size-5 items-center justify-center rounded-full bg-[var(--color-success-surface)] text-[10px] font-bold text-[var(--color-success)]"
          : "inline-flex size-5 items-center justify-center rounded-full bg-bone text-[10px] font-bold text-ink-300"
      }
      title={`${label}: ${done ? "done" : "pending"}`}
      aria-label={`${label}: ${done ? "done" : "pending"}`}
    >
      {done ? "✓" : "·"}
    </span>
  );
}

function PendingCell({ row }: { row: TrackingRow }) {
  if (row.caseId === undefined) {
    return <span className="text-xs text-muted-foreground">Case not opened</span>;
  }
  if (row.decided) {
    return <span className="text-xs text-muted-foreground">Decided</span>;
  }
  if (row.pending.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  // A case carries one obligation per owner (e.g. five reviewers each owe a
  // peer answer), so aggregate per kind: count + the oldest open age.
  const byKind = new Map<string, { count: number; openDays: number | undefined }>();
  for (const action of row.pending) {
    const entry = byKind.get(action.kind) ?? { count: 0, openDays: undefined };
    entry.count += 1;
    if (action.openDays !== undefined) {
      entry.openDays = Math.max(entry.openDays ?? 0, action.openDays);
    }
    byKind.set(action.kind, entry);
  }
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {[...byKind.entries()].map(([kind, entry]) => (
        <span
          key={kind}
          className={
            entry.openDays !== undefined && entry.openDays >= 7
              ? "rounded-full bg-coral px-2 py-0.5 text-[11px] font-semibold text-[var(--color-coral-text)]"
              : "rounded-full bg-[var(--color-blush)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent-tint-text)]"
          }
          title={
            entry.openDays !== undefined
              ? `Open for ${entry.openDays} ${entry.openDays === 1 ? "day" : "days"}`
              : undefined
          }
        >
          {OBLIGATION_LABEL[kind] ?? kind}
          {entry.count > 1 && <span className="tabular-nums"> ×{entry.count}</span>}
          {entry.openDays !== undefined && entry.openDays > 0 && (
            <span className="tabular-nums"> · {entry.openDays}d</span>
          )}
        </span>
      ))}
    </span>
  );
}

function Tracking() {
  const view: TrackingView = Route.useLoaderData();
  const { reports } = Route.useSearch();
  const hasDirectReports = view.rows.some((row) => row.reportLine === "direct");
  const hasIndirectReports = view.rows.some((row) => row.reportLine === "indirect");
  const showReportFilter = hasDirectReports && hasIndirectReports;
  const rows = filterRows(view.rows, showReportFilter ? reports : undefined);
  const total = rows.length;
  const notOpenedCount = rows.filter((row) => row.caseId === undefined).length;
  const decidedCount = rows.filter((row) => row.decided).length;
  const openedCount = total - notOpenedCount;
  const counts: Partial<Record<ReviewState, number>> = {};
  for (const row of rows) {
    if (row.decided || row.state === undefined) {
      continue;
    }
    counts[row.state] = (counts[row.state] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Review cycle
      </p>
      <div className="flex items-baseline justify-between">
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Tracking</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {total} {total === 1 ? "person" : "people"}
          {notOpenedCount > 0 && <> · {notOpenedCount} not opened</>}
          {openedCount > 0 && <> · {decidedCount} decided</>}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">
        Who still has to do what in the {view.cycle} cycle. The same derivation feeds the weekly
        reminder emails, so this board and the inbox can never disagree.
      </p>

      {showReportFilter && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/tracking" search={{}} className={filterPillClass(reports === undefined)}>
            All reports
          </Link>
          <Link
            to="/tracking"
            search={{ reports: "direct" }}
            className={filterPillClass(reports === "direct")}
          >
            Direct reports
          </Link>
          <Link
            to="/tracking"
            search={{ reports: "indirect" }}
            className={filterPillClass(reports === "indirect")}
          >
            Indirect reports
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {notOpenedCount > 0 && (
          <span className="rounded-full border border-border bg-cream px-3 py-1 text-xs font-semibold">
            not opened <span className="tabular-nums">{notOpenedCount}</span>
          </span>
        )}
        {STATE_ORDER.map((state) => {
          const count = counts[state];
          if (count === undefined || count === 0) {
            return null;
          }
          return (
            <span
              key={state}
              className="rounded-full border border-border bg-cream px-3 py-1 text-xs font-semibold"
            >
              {state.replace(/_/g, " ")} <span className="tabular-nums">{count}</span>
            </span>
          );
        })}
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader>
          <CardTitle>People</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-2.5 font-semibold">Person</th>
                  <th className="px-3 py-2.5 font-semibold">State</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Self</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Peers</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Assessment</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Sign-off</th>
                  <th className="px-6 py-2.5 text-right font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-center text-muted-foreground">
                      No one in scope for this cycle.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr
                    key={row.caseId ?? row.subjectEmail}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-6 py-3">
                      {row.subjectUserId !== undefined ? (
                        <Link
                          to="/people/$userId"
                          params={{ userId: row.subjectUserId }}
                          className="block truncate font-semibold hover:text-[var(--color-accent)]"
                        >
                          {row.subjectName ?? row.subjectEmail}
                        </Link>
                      ) : (
                        <span className="block truncate font-semibold">
                          {row.subjectName ?? row.subjectEmail}
                        </span>
                      )}
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.subjectEmail}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {row.state === undefined ? "not opened" : row.state.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StageDot done={row.selfSubmitted} label="Self-review" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center">
                      <span
                        className={
                          row.quotaMet
                            ? "text-xs font-semibold tabular-nums text-[var(--color-success)]"
                            : "text-xs font-semibold tabular-nums text-ink-500"
                        }
                        title={`${row.peersSubmitted} submitted · ${row.peersPending} pending`}
                      >
                        {row.peersSubmitted}
                        {row.peersPending > 0 && ` +${row.peersPending}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StageDot done={row.assessmentSubmitted} label="Assessment" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {row.decided ? "✓" : row.signoffCount > 0 ? `${row.signoffCount}/2` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <PendingCell row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
