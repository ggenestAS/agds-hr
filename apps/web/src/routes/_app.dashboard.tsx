import { createFileRoute } from "@tanstack/react-router";

// First authenticated surface — a placeholder proving the gate + session
// context. Real "Albert People" surfaces (directory, review cycle, …) land in
// step 10 (docs/plans/web-shell.md).
export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { session } = Route.useRouteContext();
  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          Signed in
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-[var(--foreground)]">
          {session.subject.email}
        </h1>
        <p className="mt-4 text-[var(--muted-foreground)]">
          Roles: {session.subject.roles.join(", ") || "none"}
        </p>
      </div>
    </main>
  );
}
