import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "../components/ui/card.tsx";
import type { DirectoryEntry } from "../server/people.shared.ts";
import { listDirectoryFn } from "../server/people.functions.ts";

// The People directory, sourced from the Albert Inside roster. agds-hr
// level/path/rating/band position layer on in later slices (they show once
// employees are reconciled + reviews run).
export const Route = createFileRoute("/_app/people")({
  loader: () => listDirectoryFn(),
  component: People,
});

function People() {
  const directory = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        People
      </p>
      <div className="flex items-baseline justify-between">
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Directory</h1>
        {directory.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground">
            {directory.length} staff
          </span>
        )}
      </div>

      {directory.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No staff to show. Set INSIDE_API_KEY to populate the directory from Albert Inside.
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Campus</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">Reports to</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {directory.map((row: DirectoryEntry) => (
                  <tr key={row.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">{row.title ?? "—"}</td>
                    <td className="px-4 py-3">{row.campus ?? "—"}</td>
                    <td className="px-4 py-3">{row.country ?? "—"}</td>
                    <td className="px-4 py-3">{row.managerName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.active
                            ? "rounded-full bg-bone px-2 py-0.5 text-xs font-semibold text-foreground"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
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
