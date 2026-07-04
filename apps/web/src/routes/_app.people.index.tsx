import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CAREER_LEVEL_META, EMPLOYMENT_TYPE_LABELS } from "@agds-hr/people/types";

import { TableRoutePending } from "../components/route-pending/shapes.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import type { DirectoryEntry } from "../server/people.shared.ts";
import { listDirectoryFn } from "../server/people.functions.ts";

// The People directory (design), sourced from the Albert Inside roster merged
// with agds-hr-native level/path. Campus filter chips; level shown with the
// design's ladder names.
export const Route = createFileRoute("/_app/people/")({
  loader: () => listDirectoryFn(),
  pendingComponent: () => <TableRoutePending width="5xl" columns={5} />,
  component: People,
});

const PATH_LABEL: Record<string, string> = { ic: "IC path", manager: "Management" };

type SortKey = "name" | "level" | "campus" | "functionalManager" | "localManager";

// Missing values sort last regardless of direction, so "—" rows never bury
// the informative ones.
const SORT_VALUE: Record<SortKey, (row: DirectoryEntry) => string | undefined> = {
  name: (row) => row.name,
  level: (row) => row.level,
  campus: (row) => row.campus,
  functionalManager: (row) => row.functionalManagerName,
  localManager: (row) => row.localManagerName,
};

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-5 py-3.5 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-[0.13em] hover:text-foreground"
      >
        {label}
        <span
          aria-hidden
          className={`text-[8px] leading-none ${active ? "text-foreground" : "text-ink-300"}`}
        >
          {active ? (direction === "asc" ? "▲" : "▼") : "▲▼"}
        </span>
      </button>
    </th>
  );
}

function People() {
  const directory: readonly DirectoryEntry[] = Route.useLoaderData();
  const [filter, setFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const campuses = [
    ...new Set(
      directory.map((row) => row.campus).filter((campus): campus is string => campus !== undefined),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const filtered = filter === "all" ? directory : directory.filter((row) => row.campus === filter);
  const toValue = SORT_VALUE[sortKey];
  const visible = [...filtered].sort((left, right) => {
    const a = toValue(left);
    const b = toValue(right);
    if (a === undefined || b === undefined) {
      return a === b ? 0 : a === undefined ? 1 : -1;
    }
    return sortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a);
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Directory
      </p>
      <div className="flex items-baseline justify-between">
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">People</h1>
        {directory.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {visible.length} of {directory.length} staff
          </span>
        )}
      </div>

      {campuses.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {["all", ...campuses].map((campus) => (
            <button
              key={campus}
              type="button"
              onClick={() => setFilter(campus)}
              className={
                filter === campus
                  ? "rounded-full border border-foreground bg-foreground px-4 py-1.5 text-xs font-semibold text-background"
                  : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:border-ink-500"
              }
            >
              {campus === "all" ? "Everyone" : campus}
            </button>
          ))}
        </div>
      )}

      {directory.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No staff to show. Set INSIDE_API_KEY to populate the directory from Albert Inside.
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10.5px] uppercase tracking-[0.13em] text-muted-foreground">
                  {(
                    [
                      ["Person", "name"],
                      ["Level · Path", "level"],
                      ["Campus", "campus"],
                      ["Functional manager", "functionalManager"],
                      ["Local manager", "localManager"],
                    ] as const
                  ).map(([label, key]) => (
                    <SortHeader
                      key={key}
                      label={label}
                      sortKey={key}
                      active={sortKey === key}
                      direction={sortDirection}
                      onSort={onSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row: DirectoryEntry) => (
                  <tr key={row.userId} className="border-b border-border last:border-0">
                    <td className="px-5 py-3.5">
                      <Link
                        to="/people/$userId"
                        params={{ userId: row.userId }}
                        className="font-semibold hover:text-[var(--color-accent)]"
                      >
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {row.title ?? row.email}
                        {row.employmentType !== undefined &&
                          row.employmentType !== "employee" &&
                          ` · ${EMPLOYMENT_TYPE_LABELS[row.employmentType]}`}
                        {!row.active && " · inactive"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {row.level === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <span className="block text-[13.5px] font-semibold">
                            {row.level} · {CAREER_LEVEL_META[row.level].name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {row.path === undefined ? "" : (PATH_LABEL[row.path] ?? row.path)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.campus === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-medium text-foreground">{row.campus}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{row.functionalManagerName ?? "—"}</td>
                    <td className="px-5 py-3.5">{row.localManagerName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
