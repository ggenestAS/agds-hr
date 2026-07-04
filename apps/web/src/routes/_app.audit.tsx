import { createFileRoute } from "@tanstack/react-router";

import { TableRoutePending } from "../components/route-pending/shapes.tsx";
import { Card } from "../components/ui/card.tsx";
import type { AuditLogRow } from "../server/people.shared.ts";
import { auditLogFn } from "../server/people.functions.ts";

// The Audit log surface (design P9): every state change and every read of
// compensation data, with actor, timestamp, and content — append-only and
// non-deletable, including by Admins. Leadership-read-only.
export const Route = createFileRoute("/_app/audit")({
  loader: () => auditLogFn(),
  pendingComponent: () => <TableRoutePending width="5xl" columns={4} />,
  component: AuditLog,
});

const CATEGORY_STYLE: Record<AuditLogRow["category"], string> = {
  "Sign-off": "bg-foreground text-background",
  Read: "bg-[var(--color-info-surface)] text-[var(--color-info)]",
  Write: "bg-bone text-foreground",
};

const fmtWhen = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function AuditLog() {
  const rows: readonly AuditLogRow[] = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Governance
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Audit log</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground">
        A complete record of every action in the system — who did what, and when. It includes reads
        of compensation data as well as changes, and no one can edit or delete entries.
      </p>

      <Card className="mt-6 overflow-hidden">
        <div className="grid grid-cols-[150px_minmax(0,1fr)_110px] gap-4 border-b border-border bg-[var(--color-panel-soft)] px-6 py-3 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground sm:grid-cols-[150px_190px_minmax(0,1fr)_110px]">
          <span>When</span>
          <span className="hidden sm:block">Actor</span>
          <span>Event</span>
          <span className="text-right">Type</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No audit events recorded yet.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[150px_minmax(0,1fr)_110px] items-center gap-4 border-b border-border px-6 py-3.5 last:border-b-0 sm:grid-cols-[150px_190px_minmax(0,1fr)_110px]"
            >
              <span className="text-xs leading-snug text-muted-foreground">
                {fmtWhen(row.when)}
              </span>
              <span className="hidden truncate text-[13px] font-semibold sm:block">
                {row.actor}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold">
                  {row.eventType}
                  {row.resourceId !== undefined && (
                    <span className="font-normal text-muted-foreground"> · {row.resourceId}</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  subject {row.subject}
                </span>
              </span>
              <span className="justify-self-end">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${CATEGORY_STYLE[row.category]}`}
                >
                  {row.category}
                </span>
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
