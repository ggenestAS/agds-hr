Status: built (see ADR 2026-07-02-auth-identity-session-and-policy)
Readiness: ready

# auth + identity plan

`Status`: planned → in progress → built (see ADR), then the file moves to
`completed/`. Bootstrap step 5 (new-project-directives.md §17). Frozen design:
§6; pinned choices:
[2026-07-02-auth-identity-session-and-policy.md](../decisions/2026-07-02-auth-identity-session-and-policy.md).

## Goal

Land the access foundation every authenticated surface depends on: SSO-only
BetterAuth, the actor/subject session, the deny-all policy registry, roles, and
impersonation — the mechanism behind the design's "Viewing as" switch and every
gate that follows.

## Scope

### In

- `@agds-hr/auth`: `getAuth()` (lazy BetterAuth, SSO-only, Google Workspace
  allow-list), `resolveSession` (actor/subject, fail-closed on deactivation,
  impersonation) with an injected auth-session reader, the policy registry
  (`registerPolicy`/`assertCan`, deny-all, `__resetPolicyRegistryForTests`),
  Session/User types, the `auth` drizzle schema mirroring BetterAuth's tables +
  app-owned columns.
- `@agds-hr/identity`: `identity` pgSchema (`user_role` + pg enum from
  `USER_ROLES`, `user_relationship`, `impersonation_session`), DAL
  (`hydrateUser`, `grantRole`/`revokeRole`, `deactivateUser`,
  `startImpersonation`/`stopImpersonation`, `listUsers`) — every mutation
  audited in-transaction, policies as pure predicates.
- Migration for both schemas with per-role and column-level grants; env vars in
  `ENV_MANIFEST` + `.env.example`; drizzle.config + tsconfig path entries.

### Out (with named triggers if deferred)

- Composition-root policy registration, BetterAuth catch-all route, sign-in
  page, client-safe origin subpath — **step 6** (`apps/web` exists).
- `magicLink` passwordless plugin — trigger: an audience outside Google
  Workspace needs sign-in.
- HR product roles (manager, LT member, founder, admin) — trigger: the product
  domain defines its audiences (step 10).
- Running the `[integration]` DAL tests in CI — **step 7** (disposable-branch
  harness + sentinel).

## Data model

- `auth.user` (BetterAuth-owned: `id`, `name`, `email`, `email_verified`,
  `image`, `created_at`, `updated_at`; app-owned additionalFields:
  `display_name`, `deactivated_at`), `auth.session|account|verification`.
- `identity.user_role` (`user_id`, `role` enum, `granted_at`, `granted_by`, PK
  `[user_id, role]`).
- `identity.user_relationship` (`id`, `user_id`, `related_user_id`, `kind`
  text, `created_at`; unique `[user_id, related_user_id, kind]`).
- `identity.impersonation_session` (`actor_user_id` PK, `subject_user_id`,
  `reason` text, `started_at`).

## Policies

Pure predicates in `identity/policies.ts`, registered by the step-6 composition
root: `identity.profile.update` (self or developer), `identity.user.deactivate`
(developer), `identity.role.grant` (developer), `identity.impersonation.start`
(developer, not self, target active).

## Surfaces

None this phase — surfaces are step 6+. The design's "Viewing as" switch and
role-gated views consume this phase's session + policy output.

## Open questions

- Design-system reconciliation (imported coral kit vs DNA neutral shadcn) —
  resolved at step 6, not here.
