import { createFileRoute } from "@tanstack/react-router";
import { MERIT_MATRIX_BP, REVIEW_RATING_LABELS, REVIEW_RATINGS } from "@agds-hr/people/types";
import type { BandThird } from "@agds-hr/people/types";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { bandsFn } from "../server/people.functions.ts";

// Compensation principles surface (design): the merit matrix as a guide, what
// must NOT drive pay, and the bonus/variable rules. Leadership-only — the
// loader enforces the people.comp.read gate (the matrix is internal config).
export const Route = createFileRoute("/_app/compensation")({
  loader: () => bandsFn(),
  component: Compensation,
});

const THIRDS: readonly { key: BandThird; label: string }[] = [
  { key: "low", label: "Low in band" },
  { key: "mid", label: "Around mid" },
  { key: "high", label: "High in band" },
];
const RATINGS_DESC = [...REVIEW_RATINGS].reverse();

const NOT_DRIVE = [
  "Personal financial need",
  "Loyalty or tenure alone",
  "Effort without impact",
  "Negotiation pressure or threats to leave",
  "Personal closeness to leadership",
] as const;

const fmtBp = (bp: number): string => (bp === 0 ? "No raise" : `+${(bp / 100).toFixed(1)}%`);

function Compensation() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Merit & principles
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Compensation</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
        Compensation is guided by the merit matrix but is never purely mechanical. It weighs rating,
        band position, market movement, scope, promotion, and internal equity.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-baseline justify-between">
            <CardTitle>Merit matrix — suggested increase</CardTitle>
            <span className="text-xs text-muted-foreground">Guide, not a formula</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
                {THIRDS.map((third) => (
                  <th
                    key={third.key}
                    className="p-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {third.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATINGS_DESC.map((rating) => (
                <tr key={rating}>
                  <td className="whitespace-nowrap p-2.5 text-[13px] font-bold">
                    {REVIEW_RATING_LABELS[rating]}
                  </td>
                  {THIRDS.map((third) => {
                    const bp = MERIT_MATRIX_BP[rating][third.key];
                    return (
                      <td
                        key={third.key}
                        className={
                          bp === 0
                            ? "border border-border/40 bg-[#fbf9f5] p-2.5 text-center text-[12.5px] text-ink-300"
                            : "border border-border/40 p-2.5 text-center text-[12.5px] font-medium tabular-nums"
                        }
                      >
                        {fmtBp(bp)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            A rating of 1 gets an improvement plan (P6), not a raise. Values are placeholder config
            pending Albert's final matrix.
          </p>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Should NOT drive pay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ink-700">
            {NOT_DRIVE.map((item) => (
              <div key={item} className="flex items-baseline gap-2.5">
                <span className="font-bold text-[var(--color-accent)]">✕</span>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="rounded-[14px] bg-ink-900 p-6 text-white">
          <h3 className="font-display text-base font-semibold">Bonuses & variable pay</h3>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/80">
            Bonuses are limited and discretionary — for exceptional, non-recurring impact, or to
            recognise a high-in-band performer without a raise.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
            Variable plans (admissions, partnerships) must include quality safeguards and never
            reward volume over student fit. Approved by CEO & COO.
          </p>
        </div>
      </div>
    </div>
  );
}
