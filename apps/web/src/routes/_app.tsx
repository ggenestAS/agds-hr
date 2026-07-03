import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Frame } from "../components/frame.tsx";
import { fetchSessionFn } from "../server/session.functions.ts";

// Pathless authenticated layout (docs/new-project-directives.md §9.1): resolves
// the session in beforeLoad and redirects to sign-in when absent (fail closed).
// The resolved session is placed in route context for descendants and drives
// the frame header (actor + any active impersonation).
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const session = await fetchSessionFn();
    if (session === null) {
      throw redirect({ to: "/sign-in", search: { from: location.href } });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  const impersonating = session.subject.id !== session.actor.id;
  return (
    <Frame
      user={{ email: session.actor.email, roles: session.subject.roles }}
      header={
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.actor.email}</span>
          {impersonating && (
            <span className="rounded-full bg-[var(--color-blush)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent-dk)]">
              Viewing as {session.subject.email}
            </span>
          )}
        </div>
      }
    >
      <Outlet />
    </Frame>
  );
}
