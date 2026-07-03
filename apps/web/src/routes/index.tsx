import { createFileRoute, Link } from "@tanstack/react-router";

import { buttonVariants } from "../components/ui/button.tsx";
import { cn } from "../lib/cn.ts";

// Placeholder public landing for the booting shell. The authenticated layout
// (_app), sign-in, and the "Albert People" surfaces land in the next Phase 6
// increments (docs/plans/web-shell.md).
export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Albert School
        </p>
        <h1 className="mt-3 font-display text-5xl font-medium tracking-tight text-[var(--foreground)]">
          Albert People
        </h1>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Performance reviews, calibration, compensation, and appeals for Albert School.
        </p>
        <Link
          to="/sign-in"
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-8")}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
