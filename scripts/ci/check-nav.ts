import { readFileSync } from "node:fs";

import { report } from "../lib/report.ts";

// Navigation is an anchor, not a button (docs/new-project-directives.md §9.4):
// anything that takes the user somewhere renders a real <a> (TanStack <Link>).
// `navigate()` is only for programmatic redirects, never wired to an onClick.
// This fails on the onClick={() => navigate(...)} anti-pattern.

export function findNavViolations(file: string, content: string): string[] {
  const violations: string[] = [];
  // onClick handler whose body calls navigate( — [^}] keeps it within the
  // handler expression (nested `{` is allowed, the closing `}` ends the scan).
  const re = /onClick=\{[^}]*\bnavigate\s*\(/g;
  for (const _match of content.matchAll(re)) {
    violations.push(
      `${file}: onClick handler calls navigate() — use a <Link> anchor instead (§9.4)`,
    );
  }
  return violations;
}

export function isNavScanned(file: string): boolean {
  return (
    file.endsWith(".tsx") &&
    /^apps\/web\/src\/(components|routes)\//.test(file) &&
    !file.startsWith("apps/web/src/routes/api/")
  );
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const glob = new Bun.Glob("apps/web/src/**/*.tsx");
  const files = [...glob.scanSync({ cwd: root })].filter(isNavScanned);
  const errors = files.flatMap((file) =>
    findNavViolations(file, readFileSync(`${root}/${file}`, "utf8")),
  );
  report("check:nav", errors);
}
