// Cron job registry (docs/decisions/2026-07-03-cloudflare-hosting.md: Cron
// Triggers → the Worker's scheduled handler, plus /api/cron/run/<jobId> for
// manual runs). Pure registry, no IO: job definitions live in the app's
// composition root (apps/web/src/server/cron.server.ts), mirroring how the
// policy registry works. Job ids are an open dotted-ish vocabulary.

export type CronJob = {
  readonly id: string;
  // Returns a small JSON-serializable result for the run log / HTTP response.
  readonly run: () => Promise<Record<string, unknown>>;
};

const registry = new Map<string, CronJob>();

export function registerCronJob(job: CronJob): void {
  if (registry.has(job.id)) {
    throw new Error(`cron_job_already_registered: ${job.id}`);
  }
  registry.set(job.id, job);
}

export function getCronJob(id: string): CronJob | undefined {
  return registry.get(id);
}

export function listCronJobIds(): readonly string[] {
  return [...registry.keys()];
}

// Test-only escape hatch — production never calls this.
export function __resetCronRegistryForTests(): void {
  registry.clear();
}
