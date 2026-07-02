import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { report } from "../lib/report.ts";

// Gates the documentation system of docs/new-project-directives.md §14:
// frozen dated ADRs with status banners indexed in decisions/README.md, and
// lifecycle-tracked plans with Status/Readiness fields.

export type DecisionFile = { readonly name: string; readonly firstLine: string };
export type PlanFile = { readonly name: string; readonly content: string };

const DECISION_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const DECISION_STATUS = /^Status: (frozen|superseded by \[.+\]\(.+\))$/;
const PLAN_STATUS = /^Status: (planned|in progress|built.*)$/m;
const PLAN_READINESS =
  /^Readiness: (draft|stakeholder-pending|needs-reworked|ready|ready \+ trigger-gated)$/m;

export function checkDecisions(files: readonly DecisionFile[], readmeContent: string): string[] {
  const errors: string[] = [];
  for (const file of files) {
    if (!DECISION_NAME.test(file.name)) {
      errors.push(`decisions/${file.name}: name must be YYYY-MM-DD-slug.md`);
    }
    if (!DECISION_STATUS.test(file.firstLine)) {
      errors.push(
        `decisions/${file.name}: line 1 must be "Status: frozen" or "Status: superseded by [link]"`,
      );
    }
    if (!readmeContent.includes(`(./${file.name})`)) {
      errors.push(`decisions/${file.name}: not indexed in decisions/README.md`);
    }
  }
  const indexed = [...readmeContent.matchAll(/\(\.\/(\d{4}-\d{2}-\d{2}-[^)]+\.md)\)/g)].map(
    (match) => match[1],
  );
  for (const name of indexed) {
    if (name !== undefined && !files.some((file) => file.name === name)) {
      errors.push(`decisions/README.md indexes missing file ${name}`);
    }
  }
  return errors;
}

export function checkPlans(files: readonly PlanFile[]): string[] {
  const errors: string[] = [];
  for (const file of files) {
    if (!PLAN_STATUS.test(file.content)) {
      errors.push(`plans/${file.name}: missing "Status: planned | in progress | built (see ADR)"`);
    }
    if (!PLAN_READINESS.test(file.content)) {
      errors.push(`plans/${file.name}: missing a valid "Readiness:" field`);
    }
  }
  return errors;
}

function markdownFiles(dir: string, exclude: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".md") && !exclude.includes(entry.name),
    )
    .map((entry) => entry.name);
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const decisionsDir = join(root, "docs/decisions");
  const plansDir = join(root, "docs/plans");

  const decisionFiles = markdownFiles(decisionsDir, ["0000-template.md", "README.md"]).map(
    (name) => ({
      name,
      firstLine: readFileSync(join(decisionsDir, name), "utf8").split("\n", 1)[0] ?? "",
    }),
  );
  const readmeContent = readFileSync(join(decisionsDir, "README.md"), "utf8");

  const planFiles = markdownFiles(plansDir, ["0000-template.md"]).map((name) => ({
    name,
    content: readFileSync(join(plansDir, name), "utf8"),
  }));

  // CHARTER.md must exist — reading it throws if not.
  readFileSync(join(root, "docs/CHARTER.md"), "utf8");

  report("check:docs", [...checkDecisions(decisionFiles, readmeContent), ...checkPlans(planFiles)]);
}
