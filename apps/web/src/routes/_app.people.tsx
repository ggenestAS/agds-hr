import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "../components/ui/card.tsx";
import { listDirectoryFn } from "../server/people.functions.ts";

// The People directory (the design's primary surface). Rating and band position
// are review/comp outputs — shown pending until those slices land. Empty until
// employees are provisioned (no demo data).
export const Route = createFileRoute("/_app/people")({
  loader: () => listDirectoryFn(),
  component: People,
});

const PATH_LABEL = { ic: "IC", manager: "Manager" } as const;

function People() {
  const directory = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        People
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Directory</h1>

      {directory.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No employees yet. Provision people to populate the directory.
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
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">Band position</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {directory.map((row) => (
                  <tr key={row.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.displayName}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.level} · {PATH_LABEL[row.path]}
                    </td>
                    <td className="px-4 py-3">{row.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.bandPosition === undefined ? "—" : `${row.bandPosition}%`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.rating ?? "—"}</td>
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
