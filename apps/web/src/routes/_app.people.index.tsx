import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, CardContent } from "../components/ui/card.tsx";
import type { DirectoryEntry } from "../server/people.shared.ts";
import { listDirectoryFn } from "../server/people.functions.ts";

// The People directory, sourced from the Albert Inside roster merged with
// agds-hr-native level/path (assigned on a person's detail page) and the
// current-cycle rating. Band position layers on with the comp slice.
export const Route = createFileRoute("/_app/people/")({
  loader: () => listDirectoryFn(),
  component: People,
});

const PATH_LABEL: Record<string, string> = { ic: "IC", manager: "Manager" };

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
                  <th className="px-4 py-3 font-semibold">Level · Path</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Campus</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">Reports to</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {directory.map((row: DirectoryEntry) => (
                  <tr key={row.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/people/$userId"
                        params={{ userId: row.userId }}
                        className="font-medium hover:text-[var(--color-accent)]"
                      >
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.level === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <span className="font-semibold">{row.level}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {row.path === undefined ? "" : (PATH_LABEL[row.path] ?? row.path)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.title ?? "—"}</td>
                    <td className="px-4 py-3">{row.campus ?? "—"}</td>
                    <td className="px-4 py-3">{row.country ?? "—"}</td>
                    <td className="px-4 py-3">{row.managerName ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.rating === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-semibold">{row.rating}</span>
                      )}
                    </td>
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
