// Pick a Node binary ≥22.12 for Vite / @cloudflare/vite-plugin (module.registerHooks).
// WSL often has apt Node 18 on PATH while nvm-installed Node lives under ~/.nvm.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const MIN_MAJOR = 22;
const MIN_MINOR = 12;

export function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)/.exec(version.trim());
  if (match === null) {
    return undefined;
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function nodeMeetsMinimum(version) {
  const parsed = parseNodeVersion(version);
  if (parsed === undefined) {
    return false;
  }
  return parsed.major > MIN_MAJOR || (parsed.major === MIN_MAJOR && parsed.minor >= MIN_MINOR);
}

function nodeVersionAt(bin) {
  const result = spawnSync(bin, ["-v"], { encoding: "utf8" });
  if (result.status !== 0 || result.stdout === undefined) {
    return undefined;
  }
  return result.stdout.trim();
}

function nvmNodeBins() {
  const root = join(homedir(), ".nvm/versions/node");
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root)
    .filter((name) => /^v?\d/.test(name))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map((name) => join(root, name, "bin/node"))
    .filter((bin) => existsSync(bin));
}

export function resolveNodeBin(preferred = process.execPath) {
  const candidates = [preferred, ...nvmNodeBins().filter((bin) => bin !== preferred)];
  for (const bin of candidates) {
    const version = nodeVersionAt(bin);
    if (version !== undefined && nodeMeetsMinimum(version)) {
      return { bin, version };
    }
  }
  const seen = nodeVersionAt(preferred) ?? process.version;
  return { bin: undefined, version: seen };
}

export const NODE_MINIMUM_HINT = [
  "Node ≥22.12 required (@cloudflare/vite-plugin uses module.registerHooks).",
  "",
  "If nvm is installed but not loaded (common on WSL):",
  '  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm install',
  "",
  "Install nvm (recommended — repo has .nvmrc):",
  "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash",
  '  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm install',
  "",
  "Or NodeSource on Ubuntu/Debian:",
  "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -",
  "  sudo apt-get install -y nodejs",
].join("\n");
