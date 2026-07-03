#!/usr/bin/env node
// Run Vite for @agds-hr/web under Node — not Bun. @cloudflare/vite-plugin
// imports module.registerHooks (Node ≥22.12); Bun's node:module shim lacks it.
// docs/decisions/2026-07-03-cloudflare-hosting.md
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NODE_MINIMUM_HINT, resolveNodeBin } from "../lib/resolve-node.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_DIR = join(REPO_ROOT, "apps/web");
const ENV_FILE = join(REPO_ROOT, ".env");
const viteBin = join(WEB_DIR, "node_modules/vite/bin/vite.js");

function fail(message) {
  console.error(`dev: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  fail("usage: node scripts/dev/vite.mjs <dev|build|preview> [vite args…]");
}

const resolved = resolveNodeBin();
if (resolved.bin === undefined) {
  fail(`${NODE_MINIMUM_HINT}\n\ngot ${resolved.version} on PATH (${process.execPath})`);
}

// Monorepo .env lives at the repo root; wrangler.jsonc is under apps/web and
// only auto-loads .env from that directory. Inject root .env into the Vite
// process (Node ≥20 --env-file) and ask Wrangler to mirror process.env into
// the Worker's fetch `env` binding (applyWorkerEnv → getAuth, etc.).
const nodeArgs = [];
if (existsSync(ENV_FILE)) {
  nodeArgs.push("--env-file", ENV_FILE);
}
nodeArgs.push(viteBin, ...args);

const result = spawnSync(resolved.bin, nodeArgs, {
  cwd: WEB_DIR,
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
  },
});
process.exit(result.status ?? 1);
