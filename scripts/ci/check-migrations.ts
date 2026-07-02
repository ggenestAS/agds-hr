import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { report } from "../lib/report.ts";

// Asserts the drizzle-kit v1 migration chain is strictly linear. The v1
// layout is one timestamped folder per migration containing migration.sql +
// snapshot.json; each snapshot carries `id` and `prevIds`. Linear means:
// sortable folder names, exactly one parent per snapshot, unique ids, and
// each snapshot's parent is the previous folder's id (genesis points at the
// zero uuid) — docs/new-project-directives.md §5.2. A fork means someone
// bypassed drizzle-kit; fail closed.

export type MigrationEntry = {
  readonly folder: string;
  readonly id: string;
  readonly prevIds: readonly string[];
  readonly hasSql: boolean;
};

const GENESIS = "00000000-0000-0000-0000-000000000000";
const FOLDER_NAME = /^\d{14}_[a-z0-9-]+$/;

export function checkMigrations(entries: readonly MigrationEntry[]): string[] {
  const errors: string[] = [];
  const ordered = [...entries].sort((a, b) => a.folder.localeCompare(b.folder));

  for (const entry of ordered) {
    if (!FOLDER_NAME.test(entry.folder)) {
      errors.push(`${entry.folder}: folder name must be a sortable <timestamp>_<slug>`);
    }
    if (!entry.hasSql) {
      errors.push(`${entry.folder}: missing migration.sql`);
    }
    if (entry.prevIds.length !== 1) {
      errors.push(
        `${entry.folder}: snapshot has ${entry.prevIds.length} parents — the chain must be strictly linear`,
      );
    }
  }

  const ids = ordered.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    errors.push("snapshot ids are not unique");
  }

  ordered.forEach((entry, position) => {
    const expectedParent = position === 0 ? GENESIS : ordered[position - 1]?.id;
    const parent = entry.prevIds[0];
    if (entry.prevIds.length === 1 && expectedParent !== undefined && parent !== expectedParent) {
      errors.push(
        `${entry.folder}: snapshot chain fork — parent ${parent} does not match ${expectedParent}`,
      );
    }
  });

  return errors;
}

export function readMigrationEntries(migrationsDir: string): MigrationEntry[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const folder = dirent.name;
      const snapshotPath = join(migrationsDir, folder, "snapshot.json");
      if (!existsSync(snapshotPath)) {
        return { folder, id: `missing-snapshot:${folder}`, prevIds: [], hasSql: false };
      }
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
        id: string;
        prevIds: readonly string[];
      };
      return {
        folder,
        id: snapshot.id,
        prevIds: snapshot.prevIds,
        hasSql: existsSync(join(migrationsDir, folder, "migration.sql")),
      };
    });
}

if (import.meta.main) {
  const root = new URL("../..", import.meta.url).pathname;
  const migrationsDir = join(root, "packages/db/migrations");

  if (!existsSync(migrationsDir)) {
    report("check:migrations", ["packages/db/migrations is missing"]);
  } else {
    report("check:migrations", checkMigrations(readMigrationEntries(migrationsDir)));
  }
}
