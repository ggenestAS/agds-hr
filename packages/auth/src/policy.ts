import { DENY, ForbiddenError, type PolicyDecision } from "@agds-hr/shared";

import type { User } from "./types.ts";

// A registry-based policy engine, deny-all by default
// (docs/new-project-directives.md §6.3). Each domain exports pure predicate
// functions; the composition root (step 6) imports them all and calls
// registerPolicy at boot. Unregistered action -> deny; double registration
// throws; deny reasons are snake_case.
export type PolicyHandler = (user: User, resource?: unknown) => PolicyDecision;

const registry = new Map<string, PolicyHandler>();

export function registerPolicy(action: string, handler: PolicyHandler): void {
  if (registry.has(action)) {
    throw new Error(`policy_double_registration: ${action}`);
  }
  registry.set(action, handler);
}

export function can(user: User, action: string, resource?: unknown): PolicyDecision {
  const handler = registry.get(action);
  if (handler === undefined) {
    return DENY("unregistered_action");
  }
  return handler(user, resource);
}

export function assertCan(user: User, action: string, resource?: unknown): void {
  const decision = can(user, action, resource);
  if (!decision.allow) {
    throw new ForbiddenError(action, decision.reason);
  }
}

// The composition root registers this once; its presence lets boot be
// re-entrant under dev HMR without a double-registration throw (§6.3).
export const POLICY_BOOTSTRAP_PROBE = "auth.bootstrap.probe";

export function isPolicyRegistered(action: string): boolean {
  return registry.has(action);
}

// Test-only escape hatch — production never calls this.
export function __resetPolicyRegistryForTests(): void {
  registry.clear();
}
