import { existsSync } from "node:fs";
import { join } from "node:path";

// Pre-commit unit tests scoped to the packages/areas touching staged files.
// Integration suites are excluded by the same pattern as test:unit — they run
// only under the disposable-branch wrapper (bootstrap step 7).

export function affectedRoots(staged: readonly string[]): string[] {
  const roots = new Set<string>();
  for (const file of staged) {
    if (!/\.tsx?$/.test(file)) {
      continue;
    }
    const parts = file.split("/");
    if (parts[0] === "packages" || parts[0] === "apps") {
      const depth = parts[1] === "domains" || parts[1] === "integrations" ? 3 : 2;
      const root = parts.slice(0, depth).join("/");
      if (parts.length > depth) {
        roots.add(root);
      }
    } else if (parts[0] === "scripts") {
      roots.add("scripts");
    }
  }
  return [...roots].sort();
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const bail = args.includes("--bail");
  const staged = args.filter((arg) => arg !== "--bail");

  const repoRoot = new URL("../..", import.meta.url).pathname;
  const roots = affectedRoots(staged).filter((root) => existsSync(join(repoRoot, root)));
  if (roots.length === 0) {
    process.exit(0);
  }

  const result = Bun.spawnSync(
    [
      "bun",
      "test",
      ...(bail ? ["--bail"] : []),
      "--test-name-pattern",
      "^(?!.*\\[integration\\])",
      ...roots,
    ],
    { cwd: repoRoot, stdout: "inherit", stderr: "inherit" },
  );
  process.exit(result.exitCode);
}
