import { describe, expect, test } from "bun:test";

import { UserId } from "@agds-hr/shared";

import { managedUserIds, type ManagerEdge } from "./graph.ts";

const A = UserId("00000000-0000-4000-8000-00000000000a");
const B = UserId("00000000-0000-4000-8000-00000000000b");
const C = UserId("00000000-0000-4000-8000-00000000000c");
const D = UserId("00000000-0000-4000-8000-00000000000d");

const edge = (userId: UserId, managerUserId: UserId): ManagerEdge => ({ userId, managerUserId });

describe("managedUserIds", () => {
  test("direct = one hop, all = transitive closure across either line", () => {
    // A manages B (functional) and C (local); C manages D.
    const edges = [edge(B, A), edge(C, A), edge(D, C)];
    const sets = managedUserIds(edges, A);
    expect([...sets.direct].sort()).toEqual([B, C].sort());
    expect([...sets.all].sort()).toEqual([B, C, D].sort());
    // D's manager set: nothing.
    expect(managedUserIds(edges, D).all.size).toBe(0);
  });

  test("duplicate edges (same pair on both lines) count once", () => {
    const edges = [edge(B, A), edge(B, A)];
    const sets = managedUserIds(edges, A);
    expect(sets.direct.size).toBe(1);
    expect(sets.all.size).toBe(1);
  });

  test("cycles terminate and never include the root", () => {
    // A -> B -> A cycle, plus B -> C.
    const edges = [edge(B, A), edge(A, B), edge(C, B)];
    const sets = managedUserIds(edges, A);
    expect(sets.all.has(A)).toBe(false);
    expect(sets.all.has(B)).toBe(true);
    expect(sets.all.has(C)).toBe(true);
  });
});
