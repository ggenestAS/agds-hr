import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

// The framework imports `getRouter` from this file (start-plugin-core's
// route-tree-footer generates `Awaited<ReturnType<typeof getRouter>>`); the
// name is a fixed convention. Router defaults per §9.1.
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });
}
