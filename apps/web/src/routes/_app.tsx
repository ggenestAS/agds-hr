import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { fetchSessionFn } from "../server/session.functions.ts";

// Pathless authenticated layout (docs/new-project-directives.md §9.1): resolves
// the session in beforeLoad and redirects to sign-in when absent (fail closed).
// The resolved session is placed in route context for descendants.
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
  return <Outlet />;
}
