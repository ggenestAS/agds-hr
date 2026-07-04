import { readFileSync } from "node:fs";

import { report } from "../lib/report.ts";

// Colors in web markup go through theme tokens (app.css @theme / :root / .dark),
// never raw hex literals in arbitrary Tailwind values. A hardcoded hex ignores
// the .dark overrides and produced invisible text in dark mode (e.g. the old
// `bg-coral text-[#5a2018]` rating pills). rgba() accent tints are exempt: the
// two in use are translucent washes of the accent, which is identical in both
// themes.

const HEX_IN_CLASS = /\[#[0-9a-fA-F]{3,8}\]/g;

export function findThemeViolations(file: string, content: string): string[] {
  const violations: string[] = [];
  for (const match of content.matchAll(HEX_IN_CLASS)) {
    violations.push(
      `${file}: raw hex color ${match[0]} in markup — use a theme token with a .dark override (app.css)`,
    );
  }
  return violations;
}

export function isThemeScanned(file: string): boolean {
  return file.endsWith(".tsx") && /^apps\/web\/src\/(components|routes)\//.test(file);
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const glob = new Bun.Glob("apps/web/src/**/*.tsx");
  const files = [...glob.scanSync({ cwd: root })].filter(isThemeScanned);
  const errors = files.flatMap((file) =>
    findThemeViolations(file, readFileSync(`${root}/${file}`, "utf8")),
  );
  report("check:theme", errors);
}
