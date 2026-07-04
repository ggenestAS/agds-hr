import handler from "@tanstack/react-start/server-entry";

import { getAuth } from "@agds-hr/auth";
import { runWithRequestDbScope } from "@agds-hr/db";

import { applyWorkerEnv } from "./lib/worker-env.ts";

// Custom Worker entry — BetterAuth owns /api/auth/*, the cron runner owns
// /api/cron/run/*; everything else uses the TanStack Start handler.
// wrangler.jsonc must set main to src/server.ts (not the default server-entry)
// or auth routes 404 in production.
//
// runWithRequestDbScope: Workers forbid reusing sockets across requests, so db
// clients (and the BetterAuth instance built on them) must be created fresh per
// request — a module-level memo would hand later requests dead connections
// ("Failed query" on every warm-isolate request).
//
// Cron jobs are lazy-imported so the cold-start path pays nothing for them.
type ScheduledController = { readonly cron: string };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

export default {
  fetch(request: Request, env: unknown): Response | Promise<Response> {
    applyWorkerEnv(env);

    return runWithRequestDbScope(() => {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/api/auth/")) {
        return getAuth().handler(request);
      }
      if (pathname.startsWith("/api/cron/run/")) {
        return import("./server/cron.server.ts").then((cron) => cron.handleCronRequest(request));
      }
      return handler.fetch(request);
    });
  },

  // Cloudflare Cron Triggers (wrangler.jsonc `triggers.crons`) land here with
  // the firing expression; CRON_SCHEDULE_JOBS maps it to a registry job.
  scheduled(controller: ScheduledController, env: unknown, ctx: ExecutionContext): void {
    applyWorkerEnv(env);
    ctx.waitUntil(
      runWithRequestDbScope(() =>
        import("./server/cron.server.ts").then((cron) => cron.runScheduledJob(controller.cron)),
      ),
    );
  },
};
