import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { CAREER_LEVELS, CAREER_LEVEL_META } from "@agds-hr/people/types";
import type { CareerLevel } from "@agds-hr/people/types";

import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import type { BandsView } from "../server/people.shared.ts";
import { bandsFn, setBandFn } from "../server/people.functions.ts";

// Salary bands surface (design): France-reference bands by role family & level
// with a min–mid–max bar, country coefficients, and the phased-transparency
// roadmap. Internal — the loader enforces the people.comp.read gate. Founders
// edit the figures in place (people.band.manage); every write is audited.
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

type BandDraft = { minEur: string; midEur: string; maxEur: string };

const numCls =
  "block w-24 rounded-[10px] border border-border bg-card px-2 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--color-accent)]";

function Bands() {
  const data: BandsView = Route.useLoaderData();
  const router = useRouter();
  const scaleMax = Math.max(1, ...data.bands.map((band) => band.maxEur)) * 1.05;

  const [busy, setBusy] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<BandDraft>({ minEur: "", midEur: "", maxEur: "" });
  const [adding, setAdding] = useState(false);
  const [newFamily, setNewFamily] = useState("");
  const [newLevel, setNewLevel] = useState<CareerLevel>("L1");

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const draftValid = (): boolean => {
    const min = Number(draft.minEur);
    const mid = Number(draft.midEur);
    const max = Number(draft.maxEur);
    return (
      Number.isInteger(min) &&
      Number.isInteger(mid) &&
      Number.isInteger(max) &&
      min >= 0 &&
      min <= mid &&
      mid <= max
    );
  };

  const saveBand = (roleFamily: string, level: CareerLevel) =>
    run(async () => {
      await setBandFn({
        data: {
          roleFamily,
          level,
          minEur: Number(draft.minEur),
          midEur: Number(draft.midEur),
          maxEur: Number(draft.maxEur),
        },
      });
      setEditingKey(null);
      setAdding(false);
      setNewFamily("");
    });

  const startEdit = (key: string, band: { minEur: number; midEur: number; maxEur: number }) => {
    setEditingKey(key);
    setAdding(false);
    setDraft({
      minEur: String(band.minEur),
      midEur: String(band.midEur),
      maxEur: String(band.maxEur),
    });
  };

  const editorFields = (
    <div className="flex flex-wrap items-end gap-2">
      {(
        [
          ["minEur", "Min"],
          ["midEur", "Mid"],
          ["maxEur", "Max"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="text-xs">
          <span className="mb-1 block font-semibold text-ink-700">{label} €</span>
          <input
            value={draft[key]}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, [key]: event.target.value.replace(/\D/g, "") }))
            }
            inputMode="numeric"
            className={numCls}
          />
        </label>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Internal · leadership only
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Salary bands</h1>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle>Bands by family & level</CardTitle>
              {data.canManageBands && (
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dk)]"
                  onClick={() => {
                    setAdding((value) => !value);
                    setEditingKey(null);
                    setDraft({ minEur: "", midEur: "", maxEur: "" });
                  }}
                >
                  {adding ? "Close" : "+ Add band"}
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Two families per level — jobs with a high variable component (lower base, variable
              plan on top) and jobs with a low variable component. France reference · adjust by
              country coefficient. Internal — used by CEO, COO & leadership.
              {data.canManageBands && " Edits are recorded in the audit trail."}
            </p>
          </CardHeader>
          <CardContent>
            {adding && (
              <div className="mb-5 space-y-3 rounded-[14px] bg-cream p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-40 flex-1 text-xs">
                    <span className="mb-1 block font-semibold text-ink-700">Family</span>
                    <input
                      value={newFamily}
                      onChange={(event) => setNewFamily(event.target.value)}
                      placeholder="e.g. High variable"
                      maxLength={100}
                      className="block w-full rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-semibold text-ink-700">Level</span>
                    <select
                      value={newLevel}
                      onChange={(event) => setNewLevel(event.target.value as CareerLevel)}
                      className="block rounded-[10px] border border-border bg-card px-2 py-1.5 text-sm"
                    >
                      {CAREER_LEVELS.map((value) => (
                        <option key={value} value={value}>
                          {value} · {CAREER_LEVEL_META[value].name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {editorFields}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || newFamily.trim().length === 0 || !draftValid()}
                    onClick={() => void saveBand(newFamily.trim(), newLevel)}
                  >
                    Save band
                  </Button>
                </div>
              </div>
            )}

            {data.bands.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No bands configured yet.
                {data.canManageBands && " Use “Add band” to enter the first figures."}
              </p>
            ) : (
              <div className="space-y-4">
                {data.bands.map((band) => {
                  const key = `${band.roleFamily}-${band.level}`;
                  const editing = editingKey === key;
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {band.roleFamily} — {band.level} {CAREER_LEVEL_META[band.level].name}
                        </span>
                        <span className="flex items-baseline gap-3">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {fmtEur(band.minEur)} – mid {fmtEur(band.midEur)} –{" "}
                            {fmtEur(band.maxEur)}
                          </span>
                          {data.canManageBands && (
                            <button
                              type="button"
                              className="text-xs font-semibold text-muted-foreground underline hover:text-foreground"
                              onClick={() => (editing ? setEditingKey(null) : startEdit(key, band))}
                            >
                              {editing ? "Cancel" : "Edit"}
                            </button>
                          )}
                        </span>
                      </div>
                      {editing ? (
                        <div className="flex flex-wrap items-end gap-3 rounded-[14px] bg-cream p-3.5">
                          {editorFields}
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || !draftValid()}
                            onClick={() => void saveBand(band.roleFamily, band.level)}
                          >
                            Save
                          </Button>
                          {!draftValid() && (
                            <span className="text-xs text-muted-foreground">min ≤ mid ≤ max</span>
                          )}
                        </div>
                      ) : (
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
                      )}
                    </div>
                  );
                })}
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
