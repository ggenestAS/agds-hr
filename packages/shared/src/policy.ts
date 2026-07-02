export type PolicyDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };

export const ALLOW: PolicyDecision = { allow: true };
export const DENY = (reason: string): PolicyDecision => ({
  allow: false,
  reason,
});
