import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type { AppealCategory } from "@agds-hr/people/types";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import type { AppealView } from "../server/people.shared.ts";
import { appealsListFn, resolveAppealFn } from "../server/people.functions.ts";

// The HR appeals queue (design): dual-founder sign-off leaves no non-deciding
// founder, so appeals route to Admins. Appeals are stored off to the side and
// never joined into review/comp reads, keeping them out of performance views.
export const Route = createFileRoute("/_app/appeals")({
  loader: () => appealsListFn(),
  component: Appeals,
});

const CATEGORY_LABEL: Record<AppealCategory, string> = {
  rating: "Rating",
  raise: "Raise",
  band: "Band",
  exception: "Other",
};

function Appeals() {
  const appeals: readonly AppealView[] = Route.useLoaderData();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = appeals.filter((appeal) => appeal.status === "open");
  const resolved = appeals.filter((appeal) => appeal.status === "resolved");

  const resolve = async (appealId: string) => {
    const resolution = (drafts[appealId] ?? "").trim();
    if (resolution.length === 0) {
      return;
    }
    setBusy(true);
    try {
      await resolveAppealFn({ data: { appealId, resolution } });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Appeals
      </p>
      <div className="flex items-baseline justify-between">
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">HR appeals queue</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {open.length} open · {resolved.length} resolved
        </span>
      </div>

      {appeals.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No appeals have been filed.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {open.map((appeal) => (
            <Card key={appeal.id} variant="warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="rounded-full bg-[var(--color-blush)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
                    {CATEGORY_LABEL[appeal.category]}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {appeal.appellantEmail}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{appeal.statement}</p>
                <textarea
                  value={drafts[appeal.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [appeal.id]: event.target.value }))
                  }
                  rows={3}
                  maxLength={4000}
                  placeholder="Record the resolution…"
                  className="block w-full rounded-[10px] border border-border bg-card px-3 py-2"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || (drafts[appeal.id] ?? "").trim().length === 0}
                  onClick={() => {
                    void resolve(appeal.id);
                  }}
                >
                  Resolve appeal
                </Button>
              </CardContent>
            </Card>
          ))}

          {resolved.map((appeal) => (
            <Card key={appeal.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {CATEGORY_LABEL[appeal.category]}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {appeal.appellantEmail}
                  </span>
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    Resolved
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap text-muted-foreground">{appeal.statement}</p>
                {appeal.resolution !== undefined && (
                  <div className="rounded-[10px] bg-cream px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resolution
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{appeal.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Appeals are visible to HR Admins and the appellant only.{" "}
        <Link to="/people" className="underline hover:text-foreground">
          Back to people
        </Link>
      </p>
    </div>
  );
}
