import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CAREER_LEVEL_META, EMPLOYMENT_TYPE_LABELS } from "@agds-hr/people/types";

import { TableRoutePending } from "../components/route-pending/shapes.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import type { DirectoryEntry } from "../server/people.shared.ts";
import { listDirectoryFn } from "../server/people.functions.ts";

// The People directory (design), sourced from the Albert Inside roster merged
// with agds-hr-native level/path and the current-cycle rating. Country filter
// chips; level shown with the design's ladder names; rating as a chip.
export const Route = createFileRoute("/_app/people/")({
  loader: () => listDirectoryFn(),
  pendingComponent: () => <TableRoutePending width="5xl" columns={5} />,
  component: People,
});

const PATH_LABEL: Record<string, string> = { ic: "IC path", manager: "Management" };

function People() {
  const directory: readonly DirectoryEntry[] = Route.useLoaderData();
  const [filter, setFilter] = useState<string>("all");

  const countries = [
    ...new Set(
      directory
        .map((row) => row.country)
        .filter((country): country is string => country !== undefined),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const visible = filter === "all" ? directory : directory.filter((row) => row.country === filter);

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

      {countries.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {["all", ...countries].map((country) => (
            <button
              key={country}
              type="button"
              onClick={() => setFilter(country)}
              className={
                filter === country
                  ? "rounded-full border border-ink-900 bg-ink-900 px-4 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-500"
              }
            >
              {country === "all" ? "Everyone" : country}
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
                  <th className="px-5 py-3.5 font-semibold">Person</th>
                  <th className="px-5 py-3.5 font-semibold">Level · Path</th>
                  <th className="px-5 py-3.5 font-semibold">Country</th>
                  <th className="px-5 py-3.5 font-semibold">Functional manager</th>
                  <th className="px-5 py-3.5 font-semibold">Local manager</th>
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
                      {row.country === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="rounded bg-bone px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider text-ink-700">
                            {row.country.slice(0, 2).toUpperCase()}
                          </span>
                          {row.country}
                        </span>
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
