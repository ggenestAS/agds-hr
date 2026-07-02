import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ENV_MANIFEST } from "@agds-hr/env";

import { report } from "../lib/report.ts";

// Gates three-way drift between ENV_MANIFEST, .env.example, and actual env
// reads in code — docs/new-project-directives.md §11. Recognized read forms:
//   readRequired("X") / readOptional("X") / readValidated("X", …)
//   isConfigured(["X", …])
//   process.env.X
//   envVar: "X"        (indirect reads via a config table, e.g. packages/db)
// Test files are excluded (they read fakes); the env package's own internals
// and scripts/ci are excluded (they define the machinery).

export type CodeRead = { readonly name: string; readonly file: string };

const READ_PATTERNS = [
  /read(?:Required|Optional|Validated)\(\s*"([A-Z][A-Z0-9_]*)"/g,
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /envVar:\s*"([A-Z][A-Z0-9_]*)"/g,
];
const IS_CONFIGURED = /isConfigured\(\s*\[([^\]]*)\]/g;

export function extractCodeReads(file: string, content: string): CodeRead[] {
  const reads: CodeRead[] = [];
  for (const pattern of READ_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (match[1] !== undefined) {
        reads.push({ name: match[1], file });
      }
    }
  }
  for (const match of content.matchAll(IS_CONFIGURED)) {
    for (const inner of (match[1] ?? "").matchAll(/"([A-Z][A-Z0-9_]*)"/g)) {
      if (inner[1] !== undefined) {
        reads.push({ name: inner[1], file });
      }
    }
  }
  return reads;
}

export function extractExampleNames(content: string): string[] {
  return content
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

export function checkEnv(input: {
  readonly manifestNames: readonly string[];
  readonly exampleNames: readonly string[];
  readonly codeReads: readonly CodeRead[];
}): string[] {
  const errors: string[] = [];
  const manifest = new Set(input.manifestNames);
  const example = new Set(input.exampleNames);
  const readNames = new Set(input.codeReads.map((read) => read.name));

  for (const name of manifest) {
    if (!example.has(name)) {
      errors.push(`${name}: in ENV_MANIFEST but missing from .env.example`);
    }
    if (!readNames.has(name)) {
      errors.push(`${name}: in ENV_MANIFEST but never read in code — remove it`);
    }
  }
  for (const name of example) {
    if (!manifest.has(name)) {
      errors.push(`${name}: in .env.example but missing from ENV_MANIFEST`);
    }
  }
  for (const read of input.codeReads) {
    if (!manifest.has(read.name)) {
      errors.push(`${read.name}: read in ${read.file} but missing from ENV_MANIFEST`);
    }
  }
  return errors;
}

const SCAN_EXCLUDE = [/\.test\.ts$/, /^scripts\/ci\//, /^scripts\/lib\//, /^packages\/env\/src\//];

export function isScanned(file: string): boolean {
  return !SCAN_EXCLUDE.some((pattern) => pattern.test(file));
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const glob = new Bun.Glob("{apps,packages,scripts}/**/*.{ts,tsx}");
  const files = [...glob.scanSync({ cwd: root }), "drizzle.config.ts"].filter(
    (file) => !file.includes("node_modules") && isScanned(file),
  );

  const codeReads = files.flatMap((file) =>
    extractCodeReads(relative(root, join(root, file)), readFileSync(join(root, file), "utf8")),
  );
  const exampleNames = extractExampleNames(readFileSync(join(root, ".env.example"), "utf8"));

  report(
    "check:env",
    checkEnv({
      manifestNames: ENV_MANIFEST.map((spec) => spec.name),
      exampleNames,
      codeReads,
    }),
  );
}
