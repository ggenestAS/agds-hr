import { createRouter } from "@tanstack/react-router";

import { RoutePending } from "./components/route-pending/shapes.tsx";
import { routeTree } from "./routeTree.gen.ts";

// The framework imports `getRouter` from this file (start-plugin-core's
// route-tree-footer generates `Awaited<ReturnType<typeof getRouter>>`); the
// name is a fixed convention. Router defaults per §9.1: show pending UI
// quickly (150ms — faster loads never flash a skeleton, the old page just
// stays), and keep it up briefly (200ms) so fast loads don't flicker.
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
    defaultPendingComponent: RoutePending,
  });
}
