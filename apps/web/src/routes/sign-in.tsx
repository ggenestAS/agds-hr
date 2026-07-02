import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Sign-in sits outside the authenticated shell. SSO-only: the sole path is
// Google Workspace (docs/new-project-directives.md §6.1). The provider button
// activates once the BetterAuth catch-all route + OAuth credentials are wired
// (next increment); the page renders regardless.
const searchSchema = z.object({ from: z.string().optional() });

export const Route = createFileRoute("/sign-in")({
  validateSearch: searchSchema,
  component: SignIn,
});

function SignIn() {
  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Albert School
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-[var(--foreground)]">
          Sign in to Albert People
        </h1>
        <button
          type="button"
          disabled
          className="mt-8 w-full rounded-[14px] bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
        >
          Continue with Google Workspace
        </button>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Access is restricted to albertschool.com accounts.
        </p>
      </div>
    </main>
  );
}
