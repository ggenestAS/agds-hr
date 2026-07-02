import { readFileSync } from "node:fs";

import { report } from "../lib/report.ts";

// Enforces the client/server import boundary (docs/new-project-directives.md
// §9.5): in client-scanned files a single VALUE import from a domain barrel
// (@agds-hr/<domain>) drags that domain's server-only graph (Postgres,
// node:crypto) into the browser bundle. Rules:
//   - value-import from a subpath (@agds-hr/scheduling/wellbeing) — fine
//   - `import type` from any barrel — fine (types erase)
//   - @agds-hr/shared is the only allowlisted client-safe barrel
// Server code (src/server/**, *.server.ts, *.impl.server.ts) imports barrels
// freely and is not scanned.

const ALLOWLISTED_BARRELS = new Set(["@agds-hr/shared"]);

export function isClientScanned(file: string): boolean {
  if (!/\.tsx?$/.test(file)) {
    return false;
  }
  if (!/^apps\/web\/src\/(components|routes|lib)\//.test(file)) {
    return false;
  }
  if (file.startsWith("apps/web/src/routes/api/")) {
    return false;
  }
  return !file.endsWith(".server.ts") && !file.endsWith(".impl.server.ts");
}

// A bare domain barrel is `@agds-hr/<name>` with no subpath, name !== "shared".
function isDomainBarrel(specifier: string): boolean {
  const match = /^@agds-hr\/([^/]+)$/.exec(specifier);
  return match !== null && !ALLOWLISTED_BARRELS.has(specifier);
}

// True when the import clause pulls at least one runtime (value) binding.
function importsValue(clause: string): boolean {
  const trimmed = clause.trim();
  if (trimmed.startsWith("type ") || trimmed.startsWith("type{")) {
    return false; // `import type { … }` / `import type X`
  }
  const braces = /\{([\s\S]*)\}/.exec(trimmed);
  if (braces === null) {
    return true; // default or namespace import — always a value
  }
  // Named import: a value binding is any specifier not prefixed with `type `.
  return braces[1]!
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .some((part) => !part.startsWith("type "));
}

export function findBarrelViolations(file: string, content: string): string[] {
  const violations: string[] = [];
  const importRe = /import\s+([\s\S]*?)\s+from\s+["'](@agds-hr\/[^"']+)["']/g;
  for (const match of content.matchAll(importRe)) {
    const clause = match[1] ?? "";
    const specifier = match[2] ?? "";
    if (isDomainBarrel(specifier) && importsValue(clause)) {
      violations.push(
        `${file}: value import from domain barrel "${specifier}" — use a subpath or import type (§9.5)`,
      );
    }
  }
  return violations;
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const glob = new Bun.Glob("apps/web/src/**/*.{ts,tsx}");
  const files = [...glob.scanSync({ cwd: root })].filter(isClientScanned);
  const errors = files.flatMap((file) =>
    findBarrelViolations(file, readFileSync(`${root}/${file}`, "utf8")),
  );
  report("check:client-barrels", errors);
}
