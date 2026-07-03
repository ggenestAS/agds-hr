export type {
  HydratedUser,
  ResolvedAuthSession,
  Session,
  SessionDeps,
  User,
  UserRelationships,
} from "./types.ts";
export { resolveSession } from "./session.ts";
export type { PolicyHandler } from "./policy.ts";
export {
  assertCan,
  can,
  isPolicyRegistered,
  POLICY_BOOTSTRAP_PROBE,
  registerPolicy,
  __resetPolicyRegistryForTests,
} from "./policy.ts";
export { getAuth, isWorkspaceDomainAllowed, WORKSPACE_ALLOWED_DOMAINS } from "./auth.ts";
