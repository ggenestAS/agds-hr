import type { ReactNode } from "react";

import { cn } from "../../lib/cn.ts";
import { Card, CardContent, CardHeader } from "../ui/card.tsx";
import { Skeleton } from "../ui/skeleton.tsx";

// Shared kit for per-shape route skeletons (§9.1). Each pending component
// mimics its destination's real layout (same container width, header block,
// content shape) so the transition doesn't jump. RoutePendingShell carries the
// accessibility contract once: aria-busy, role="status", polite live region,
// and a screen-reader-only label.

export type PendingWidth = "3xl" | "4xl" | "5xl";

const WIDTH_CLASS: Record<PendingWidth, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export function RoutePendingShell({
  width,
  children,
}: {
  width: PendingWidth;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("mx-auto p-6", WIDTH_CLASS[width])}
    >
      <span className="sr-only">Loading page…</span>
      {children}
    </div>
  );
}

// Eyebrow + display title (+ optional intro lines) — every route opens with it.
export function PageHeaderSkeleton({ intro = false }: { intro?: boolean }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-56" />
      {intro && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full max-w-xl" />
          <Skeleton className="h-3.5 w-4/5 max-w-lg" />
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <Card aria-hidden="true" className="mt-5 overflow-hidden">
      <div
        className="grid gap-4 border-b border-border px-5 py-3.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 w-3/5" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid gap-4 border-b border-border px-5 py-4 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} className={col === 0 ? "h-4 w-4/5" : "h-4 w-3/5"} />
          ))}
        </div>
      ))}
    </Card>
  );
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-3/5" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i % 3 === 2 ? "h-4 w-2/3" : "h-4 w-full"} />
        ))}
      </CardContent>
    </Card>
  );
}

// Two side-by-side cards — the dominant authenticated-page shape.
export function TwoColumnSkeleton() {
  return (
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
      <CardSkeleton lines={7} />
      <CardSkeleton lines={5} />
    </div>
  );
}

export function StackedCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 space-y-5">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} lines={4} />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} aria-hidden="true">
          <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Dark hero header + field blocks — the self-review / peer-answer form shape.
export function FormSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-4 rounded-[14px] bg-ink-900 p-6">
        <Skeleton className="h-6 w-48 bg-white/15" />
        <Skeleton className="mt-3 h-3.5 w-4/5 max-w-xl bg-white/10" />
      </div>
      <div className="mt-4 space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
