import { describe, expect, test } from "bun:test";

import { checkMigrations, type MigrationEntry } from "./check-migrations.ts";

const GENESIS = "00000000-0000-0000-0000-000000000000";

const linear: MigrationEntry[] = [
  { folder: "20260702100000_init-audit", id: "a", prevIds: [GENESIS], hasSql: true },
  { folder: "20260703100000_identity", id: "b", prevIds: ["a"], hasSql: true },
];

describe("check-migrations", () => {
  test("accepts a strictly linear chain", () => {
    expect(checkMigrations(linear)).toEqual([]);
  });

  test("order is derived from folder names, not input order", () => {
    expect(checkMigrations([...linear].reverse())).toEqual([]);
  });

  test("rejects a forked chain (parent mismatch)", () => {
    const forked: MigrationEntry[] = [
      linear[0] as MigrationEntry,
      { folder: "20260703100000_identity", id: "b", prevIds: ["not-a"], hasSql: true },
    ];
    expect(checkMigrations(forked)).toEqual([
      "20260703100000_identity: snapshot chain fork — parent not-a does not match a",
    ]);
  });

  test("rejects a genesis snapshot not pointing at the zero uuid", () => {
    const badGenesis: MigrationEntry[] = [
      { folder: "20260702100000_x", id: "a", prevIds: ["something"], hasSql: true },
    ];
    expect(checkMigrations(badGenesis)).toEqual([
      `20260702100000_x: snapshot chain fork — parent something does not match ${GENESIS}`,
    ]);
  });

  test("rejects multi-parent snapshots", () => {
    const merged: MigrationEntry[] = [
      linear[0] as MigrationEntry,
      { folder: "20260703100000_identity", id: "b", prevIds: ["a", "c"], hasSql: true },
    ];
    expect(checkMigrations(merged)).toEqual([
      "20260703100000_identity: snapshot has 2 parents — the chain must be strictly linear",
    ]);
  });

  test("rejects duplicate snapshot ids", () => {
    const duplicated: MigrationEntry[] = [
      linear[0] as MigrationEntry,
      { folder: "20260703100000_identity", id: "a", prevIds: ["a"], hasSql: true },
    ];
    expect(checkMigrations(duplicated)).toContainEqual("snapshot ids are not unique");
  });

  test("rejects unsortable folder names and missing sql", () => {
    const broken: MigrationEntry[] = [
      { folder: "init-audit", id: "a", prevIds: [GENESIS], hasSql: false },
    ];
    const errors = checkMigrations(broken);
    expect(errors).toContainEqual("init-audit: folder name must be a sortable <timestamp>_<slug>");
    expect(errors).toContainEqual("init-audit: missing migration.sql");
  });

  test("a snapshot with zero parents is rejected, not chain-checked", () => {
    const orphan: MigrationEntry[] = [
      { folder: "20260702100000_x", id: "a", prevIds: [], hasSql: true },
    ];
    expect(checkMigrations(orphan)).toEqual([
      "20260702100000_x: snapshot has 0 parents — the chain must be strictly linear",
    ]);
  });
});
