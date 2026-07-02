Status: frozen

# Auth, identity, session, and the policy engine

Date: 2026-07-02

## Context

Bootstrap step 5 (new-project-directives.md §17) lands `packages/auth` and
`packages/domains/identity` — the foundation every authenticated surface and
every access gate depends on. The founding document §6 already freezes the
design; this record pins the choices that §6 leaves to the implementation and
the ones forced by building step 5 before the web app (step 6) and the test
harness (step 7) exist.

## Decision

- **BetterAuth owns the `auth` schema, mirrored in Drizzle.** `packages/auth`
  defines `auth.user | session | account | verification` as a drizzle
  `pgSchema` so the one migration chain manages them (never BetterAuth's own
  CLI generator). App-owned profile columns are BetterAuth `additionalFields`
  mirrored on `auth.user`: `deactivated_at`, `display_name`. Runtime roles get
  **column-level** grants on exactly those app-owned columns, never on
  BetterAuth's `name`/`email`/`image`.
- **`getAuth()` is lazy + memoized.** Nothing connects or reads env at import;
  the instance is built on first call over `getDbAs("admin")`. SSO-only:
  `emailAndPassword.enabled = false`, `disableSignUp`, `disabledPaths` block
  `/sign-in/email`, `/sign-up/email`, and `/update-user`. Google Workspace is
  the primary provider; the allow-list of workspace domains is a **hardcoded
  constant** (`["albertschool.com"]`), not an env var — the code is the system
  of record. The profile-mapping callback rejects `!email_verified` or an
  `hd` outside the allow-list with `snake_case` codes.
- **Session is actor/subject.** `resolveSession(request)` does one DB read,
  **fails closed if the user is deactivated** (a valid cookie does not survive
  deactivation), hydrates the actor, checks active impersonation, and sets
  `subject = impersonated user ?? actor`. The BetterAuth session read is
  injected (`AuthSessionReader`) so the resolver is unit-testable without a
  live BetterAuth instance or DB.
- **Policy engine: registry, deny-all.** `registerPolicy(action, handler)` /
  `assertCan(user, action, resource?)` in `packages/auth`. Unregistered action
  → `DENY("unregistered_action")`; double registration throws; deny reasons
  are `snake_case`. A `__resetPolicyRegistryForTests` hatch and a
  bootstrap-probe action make registration idempotent against dev HMR (the
  composition root lands in step 6).
- **Identity domain owns roles, relationships, impersonation.**
  `identity.user_role` (PK `[user_id, role]`, pg enum from the frozen
  `USER_ROLES` tuple, `granted_at`/`granted_by`), `identity.user_relationship`
  (`user_id`, `related_user_id`, open-vocabulary `kind` text, e.g.
  `reports_to`), `identity.impersonation_session` (one row per actor). All
  mutations are audited in-transaction via `recordEvent`; starting/stopping
  impersonation and granting/revoking roles are audited identity actions.
- **Hard DELETE on `user_role` and `impersonation_session`.** §5.3 makes soft
  delete the default and hard delete a per-table exception justified here:
  `revokeRole` hard-deletes the grant row (the `identity.role.revoked` audit
  event is the durable who/when record, so the row itself carries no history
  worth retaining), and `impersonation_session` is ephemeral session state (one
  active row per actor) that carries no meaning once stopped — the
  `identity.impersonation.stopped` audit event is the record. Every other table
  keeps the soft-delete default.
- **Roles stay `staff` + `developer`.** The HR product roles (manager, LT
  member, founder, admin) the design implies are deferred to the product
  domain (step 10) per the charter's "domain roles beyond staff/developer"
  trigger — identity ships the generic mechanism, not the product's audiences.

## Alternatives considered

- **Let BetterAuth generate and own its schema out-of-band** — Rejected
  because it forks the single migration chain `check:migrations` gates; the
  auth tables must live in the same linear chain as the domains.
- **Env-var workspace allow-list** — Rejected: §6.1 — env-configurable
  allow-lists drift; the security boundary belongs in code.
- **Resolve the BetterAuth session directly inside `resolveSession`** —
  Rejected because it makes the resolver untestable without a live auth server
  before step 7's harness exists; an injected reader keeps the actor/subject
  logic under unit test today.
- **Add the HR roles now** — Rejected: the charter defers product roles to the
  domain that defines its audiences; adding them here guesses the product's
  access model before step 10.

## Consequences

- Auth builds and typechecks without Google OAuth credentials; the feature
  only fails when exercised (§11), so step 5 lands green without live secrets.
- `resolveSession`'s injected-reader seam is unit-testable now; the live wiring
  (BetterAuth catch-all route, composition-root policy registration) lands in
  step 6.
- DB-touching identity tests are `[integration]` and skip without the
  `AGDS_HR_TEST_DB=1` sentinel (mirroring `audit`), so they wait on step 7's
  disposable-branch harness to run in CI.
- New env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`) enter `ENV_MANIFEST` and `.env.example`.

## Related

- [new-project-directives.md §6](../new-project-directives.md), §17 step 5
- [2026-07-02-database-roles-and-migrations.md](./2026-07-02-database-roles-and-migrations.md)
- [plans/auth-identity.md](../plans/auth-identity.md)
- `packages/auth/`, `packages/domains/identity/`
