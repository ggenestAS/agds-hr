import { createServerFn } from "@tanstack/react-start";

// Thin RPC transport (docs/new-project-directives.md §9.3). The impl is behind
// a lazy-import seam so its server-only graph (BetterAuth, DB) never enters the
// client bundle. GET because it is a read used by the layout loader.
export const fetchSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionHandler } = await import("./session.impl.server.ts");
  return getSessionHandler();
});
