import { createFileRoute } from "@tanstack/react-router";

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
          Performance, calibration, compensation, and appeals — the audit trail is the product.
        </p>
        <span className="mt-8 inline-block h-1 w-16 rounded-full bg-[var(--primary)]" />
      </div>
    </main>
  );
}
