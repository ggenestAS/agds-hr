// Production deploy: sync Worker secrets from .env (BETTER_AUTH_URL forced to
// production), build, wrangler deploy. Loaded with .env — run from repo root:
//   bun --env-file=.env scripts/ops/deploy-worker.ts
//
// Requires Node ≥22.12 for the Cloudflare Vite plugin, and Wrangler auth via
// `wrangler login` or CLOUDFLARE_API_TOKEN in the environment.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROD_AUTH_URL = "https://hr.albertschool.com";
const WEB_DIR = join(import.meta.dir, "../../apps/web");

// DATABASE_URL* are NOT synced as secrets: production db access goes through
// the Hyperdrive bindings in wrangler.jsonc (worker-env.ts maps each binding
// onto its DATABASE_URL* var). See docs/decisions/2026-07-03-cloudflare-hosting.md.
const SECRET_KEYS = [
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "INSIDE_API_KEY",
] as const;

function fail(message: string): never {
  console.error(`deploy_worker: ${message}`);
  process.exit(1);
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited ${result.status ?? "unknown"}`);
  }
}

function nodeMajor(): number {
  const match = /^v(\d+)/.exec(process.version);
  if (match === null) {
    fail(`unable to parse Node version ${process.version}`);
  }
  return Number(match[1]);
}

if (nodeMajor() < 22) {
  fail(`Node ≥22.12 required for build (got ${process.version})`);
}

const wranglerBin = join(WEB_DIR, "node_modules/.bin/wrangler");
const viteBin = join(WEB_DIR, "node_modules/.bin/vite");

function isWranglerAuthenticated(): boolean {
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    return true;
  }
  const whoami = spawnSync(wranglerBin, ["whoami"], {
    cwd: WEB_DIR,
    encoding: "utf8",
  });
  const output = `${whoami.stdout}${whoami.stderr}`;
  return whoami.status === 0 && !output.includes("not authenticated");
}

console.log("deploy_worker: checking Wrangler auth…");
if (!isWranglerAuthenticated()) {
  fail(
    "Wrangler is not authenticated. WSL: OAuth often fails to save — set CLOUDFLARE_API_TOKEN, or run `npx wrangler login --callback-host=0.0.0.0` with port 8976 forwarded from Windows to WSL",
  );
}

const secretLines: string[] = [`BETTER_AUTH_URL=${PROD_AUTH_URL}`];
for (const key of SECRET_KEYS) {
  const raw = process.env[key]?.trim();
  if (raw === undefined || raw === "") {
    if (key === "INSIDE_API_KEY") {
      continue;
    }
    if (key === "GOOGLE_CLIENT_ID" || key === "GOOGLE_CLIENT_SECRET") {
      console.warn(`deploy_worker: warning — ${key} unset; Google SSO will not work`);
      continue;
    }
    fail(`${key} unset in .env`);
  }
  secretLines.push(`${key}=${raw}`);
}

const secretsPath = join(mkdtempSync(join(tmpdir(), "agds-hr-secrets-")), "secrets.txt");
writeFileSync(secretsPath, `${secretLines.join("\n")}\n`, { mode: 0o600 });

try {
  console.log(`deploy_worker: syncing secrets (BETTER_AUTH_URL=${PROD_AUTH_URL})…`);
  run(wranglerBin, ["secret", "bulk", secretsPath], WEB_DIR);

  console.log("deploy_worker: building…");
  run(viteBin, ["build"], WEB_DIR);

  console.log("deploy_worker: deploying to Cloudflare Workers…");
  run(wranglerBin, ["deploy"], WEB_DIR);

  const generated = join(WEB_DIR, "dist/server/wrangler.json");
  try {
    const wranglerMeta = JSON.parse(readFileSync(generated, "utf8")) as {
      name?: string;
    };
    console.log(
      `deploy_worker: ok — worker "${wranglerMeta.name ?? "agds-hr"}" at ${PROD_AUTH_URL}`,
    );
  } catch {
    console.log(`deploy_worker: ok — live at ${PROD_AUTH_URL}`);
  }
} finally {
  unlinkSync(secretsPath);
}
