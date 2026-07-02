import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

import { getAuth } from "@agds-hr/auth";

// Custom server entry. BetterAuth owns /api/auth/* via its catch-all handler;
// everything else falls through to the TanStack Start handler. This is how the
// auth routes are mounted in this Start version — it has no createServerFileRoute
// (docs/new-project-directives.md §6.1). getAuth() is lazy, so importing this
// entry costs nothing until a request actually hits the auth path. The entry
// exports the Web-standard { fetch } shape the runtime invokes.
const startHandler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request): Response | Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/auth/")) {
      return getAuth().handler(request);
    }
    return startHandler(request);
  },
};
