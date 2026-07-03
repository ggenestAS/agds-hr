import { createFileRoute } from "@tanstack/react-router";
import { CAREER_LEVEL_META } from "@agds-hr/people/types";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { BandsView } from "../server/people.shared.ts";
import { bandsFn } from "../server/people.functions.ts";

// Salary bands surface (design): France-reference bands by role family & level
// with a min–mid–max bar, country coefficients, and the phased-transparency
// roadmap. Internal — the loader enforces the people.comp.read gate.
export const Route = createFileRoute("/_app/bands")({
  loader: () => bandsFn(),
  component: Bands,
});

const PHASES = [
  { tag: "Done", text: "Build salary bands by role family, level & country" },
  { tag: "Done", text: "Map every employee to a role, level & relevant band" },
  { tag: "Now", text: "Identify gaps, inconsistencies & exceptions" },
  { tag: "Next", text: "Progressively converge compensation toward bands" },
  { tag: "Next", text: "Document justified exceptions" },
  { tag: "Later", text: "Publish detailed band information once reliable" },
] as const;

const fmtEur = (value: number): string => `€${value.toLocaleString("en-US")}`;

function Bands() {
  const data: BandsView = Route.useLoaderData();
  const scaleMax = Math.max(1, ...data.bands.map((band) => band.maxEur)) * 1.05;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Internal · leadership only
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Salary bands</h1>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bands by role family & level</CardTitle>
            <p className="text-sm text-muted-foreground">
              France reference · adjust by country coefficient. Internal — used by CEO, COO &
              leadership.
            </p>
          </CardHeader>
          <CardContent>
            {data.bands.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No bands configured yet. Band figures are entered per role family & level as the job
                architecture is calibrated (phase 1 of the transparency roadmap).
              </p>
            ) : (
              <div className="space-y-4">
                {data.bands.map((band) => (
                  <div key={`${band.roleFamily}-${band.level}`}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-sm font-semibold">
                        {band.roleFamily} — {band.level} {CAREER_LEVEL_META[band.level].name}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmtEur(band.minEur)} – {fmtEur(band.maxEur)}
                      </span>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-bone">
                      <div
                        className="absolute bottom-0 top-0 rounded-full bg-ink-700"
                        style={{
                          left: `${(band.minEur / scaleMax) * 100}%`,
                          width: `${((band.maxEur - band.minEur) / scaleMax) * 100}%`,
                        }}
                      />
                      <div
                        className="absolute -bottom-0.5 -top-0.5 w-0.5 bg-[var(--color-accent)]"
                        style={{ left: `${(band.midEur / scaleMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Country coefficients</CardTitle>
            <p className="text-sm text-muted-foreground">
              Applied with judgment, not mechanically.
            </p>
          </CardHeader>
          <CardContent>
            {data.coefficients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coefficients configured.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.coefficients.map((coefficient) => (
                  <div key={coefficient.country} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="rounded bg-bone px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider text-ink-700">
                        {coefficient.country.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold">{coefficient.country}</span>
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums">
                      {(coefficient.coefficientBp / 10000).toFixed(2)}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 rounded-[14px] border border-border bg-cream p-6">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-lg font-semibold">Phased transparency</h3>
          <span className="text-xs text-muted-foreground">
            Transparency must be earned by the system
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Publishing uncalibrated bands would create the appearance of fairness without the
          substance. Six steps toward reliable, useful transparency.
        </p>
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((phase, index) => {
            const done = phase.tag === "Done";
            const now = phase.tag === "Now";
            return (
              <div
                key={phase.text}
                className={
                  done
                    ? "rounded-[14px] bg-ink-900 p-4 text-white"
                    : now
                      ? "rounded-[14px] border border-[var(--color-accent)] bg-card p-4"
                      : "rounded-[14px] border border-border bg-card p-4"
                }
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={
                      done
                        ? "flex size-6 items-center justify-center rounded-lg bg-white/15 text-xs font-bold text-white"
                        : now
                          ? "flex size-6 items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-bold text-white"
                          : "flex size-6 items-center justify-center rounded-lg bg-bone text-xs font-bold text-ink-300"
                    }
                  >
                    {index + 1}
                  </span>
                  <span
                    className={
                      done
                        ? "rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70"
                        : now
                          ? "rounded-full bg-[var(--color-blush)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-dk)]"
                          : "rounded-full bg-bone px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-300"
                    }
                  >
                    {phase.tag}
                  </span>
                </div>
                <div
                  className={
                    done ? "text-[13px] font-semibold text-white" : "text-[13px] font-semibold"
                  }
                >
                  {phase.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
