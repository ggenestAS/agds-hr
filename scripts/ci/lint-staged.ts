import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

// Pre-commit lint over the staged files PLUS their 1-hop reverse import
// closure: a file whose dependency changed can newly fail type-aware lint
// without itself being staged — docs/new-project-directives.md §4. CI runs
// the full tree; this keeps the staged-scope gate honest and fast.

export function reverseImportClosure(
  staged: readonly string[],
  allFiles: ReadonlyMap<string, string>,
): string[] {
  const stagedBasenames = new Set(staged.map((file) => basename(file).replace(/\.tsx?$/, "")));
  const closure = new Set(staged);
  for (const [file, content] of allFiles) {
    if (closure.has(file)) {
      continue;
    }
    for (const match of content.matchAll(/from\s+"([^"]+)"/g)) {
      const specifier = match[1];
      if (specifier === undefined || !specifier.startsWith(".")) {
        continue;
      }
      const imported = basename(specifier).replace(/\.tsx?$/, "");
      if (stagedBasenames.has(imported)) {
        closure.add(file);
        break;
      }
    }
  }
  return [...closure];
}

if (import.meta.main) {
  const staged = process.argv.slice(2).filter((file) => /\.tsx?$/.test(file));
  if (staged.length === 0) {
    process.exit(0);
  }

  const root = new URL("../..", import.meta.url).pathname;
  const glob = new Bun.Glob("{apps,packages,scripts}/**/*.{ts,tsx}");
  const allFiles = new Map<string, string>();
  for (const file of glob.scanSync({ cwd: root })) {
    if (!file.includes("node_modules")) {
      allFiles.set(file, readFileSync(join(root, file), "utf8"));
    }
  }

  const files = reverseImportClosure(staged, allFiles);
  const result = Bun.spawnSync(["bunx", "oxlint", "--type-aware", "--type-check", ...files], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode);
}
