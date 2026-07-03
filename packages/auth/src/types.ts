import type { RequestId, UserId, UserRole } from "@agds-hr/shared";

// The session is actor/subject (docs/new-project-directives.md §6.2): the actor
// is the authenticated human; the subject is the effective user policies run
// against — they differ only under impersonation.
export type UserRelationships = {
  readonly reportsTo: readonly UserId[];
  readonly manages: readonly UserId[];
  readonly localReportsTo: readonly UserId[];
  readonly localManages: readonly UserId[];
};

export type User = {
  readonly id: UserId;
  readonly email: string;
  readonly roles: readonly UserRole[];
  readonly relationships: UserRelationships;
};

export type Session = {
  readonly actor: User;
  readonly subject: User;
  readonly authSessionId: string;
  readonly requestId: RequestId;
};

// A hydrated user carries deactivation state so resolveSession can fail closed;
// the public `User` never exposes it.
export type HydratedUser = User & { readonly deactivatedAt: Date | null };

// resolveSession's dependencies are injected so the actor/subject logic is unit
// testable without a live BetterAuth instance or DB — the composition root
// (step 6) wires the real readers. See the ADR's "injected reader" rationale.
export type ResolvedAuthSession = {
  readonly userId: UserId;
  readonly authSessionId: string;
};

export type SessionDeps = {
  readonly readAuthSession: (request: Request) => Promise<ResolvedAuthSession | null>;
  readonly hydrateUser: (userId: UserId) => Promise<HydratedUser | undefined>;
  readonly readActiveImpersonation: (actorUserId: UserId) => Promise<UserId | null>;
  readonly newRequestId: () => RequestId;
};
