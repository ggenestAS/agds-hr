import type { UserId } from "@agds-hr/shared";

// Pure manager-graph walk (improve-ux plan): a person "manages" someone when
// EITHER reporting line (functional or local) connects them, directly or
// transitively. Direct = one hop on either line; indirect = further hops.
// Cycle-guarded and depth-capped like the Inside client's managementChain.

export type ManagerEdge = {
  readonly userId: UserId;
  readonly managerUserId: UserId;
};

export type ManagedSets = {
  readonly direct: ReadonlySet<UserId>;
  readonly all: ReadonlySet<UserId>;
};

const MAX_DEPTH = 10;

export function managedUserIds(edges: readonly ManagerEdge[], rootId: UserId): ManagedSets {
  const reportsByManager = new Map<UserId, UserId[]>();
  for (const edge of edges) {
    const list = reportsByManager.get(edge.managerUserId);
    if (list === undefined) {
      reportsByManager.set(edge.managerUserId, [edge.userId]);
    } else {
      list.push(edge.userId);
    }
  }

  const all = new Set<UserId>();
  const direct = new Set<UserId>(
    (reportsByManager.get(rootId) ?? []).filter((id) => id !== rootId),
  );

  let frontier: readonly UserId[] = [...direct];
  let depth = 0;
  while (frontier.length > 0 && depth < MAX_DEPTH) {
    const next: UserId[] = [];
    for (const id of frontier) {
      if (id === rootId || all.has(id)) {
        continue;
      }
      all.add(id);
      next.push(...(reportsByManager.get(id) ?? []));
    }
    frontier = next;
    depth += 1;
  }
  return { direct, all };
}
