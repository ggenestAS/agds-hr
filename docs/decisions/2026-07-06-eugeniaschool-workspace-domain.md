Status: frozen

# Eugenia School workspace domain on SSO allow-list

Date: 2026-07-06

## Context

Albert People (`hr.albertschool.com`) restricts Google Workspace SSO to a
hardcoded domain allow-list in `packages/auth` (see
[2026-07-02-auth-identity-session-and-policy.md](./2026-07-02-auth-identity-session-and-policy.md)).
`eugeniaschool.com` is a **secondary domain on the same Google Workspace**
as `albertschool.com` (not a separate tenant). Staff may sign in with either
`@albertschool.com` or `@eugeniaschool.com` addresses; the app gates on the
verified email's domain suffix.

## Decision

- Add `eugeniaschool.com` to `WORKSPACE_ALLOWED_DOMAINS` alongside
  `albertschool.com`.
- The sign-in page copy lists both domains; keep it aligned with
  `WORKSPACE_ALLOWED_DOMAINS` when that list changes.

## Alternatives considered

- **Env-var allow-list** — Rejected: same rationale as the founding auth
  decision; env-configurable allow-lists drift.
- **Separate OAuth client per domain** — Rejected: one BetterAuth instance and
  one Google OAuth client covers every domain alias on the same Workspace org;
  users are provisioned by verified email.

## Consequences

- `@eugeniaschool.com` users pass the app-side domain gate once Google OAuth
  completes. They still must be provisioned in `auth.user` before sign-in
  succeeds (`disableSignUp`).
- Google Workspace admin action may still be required for
  `admin_policy_enforced`: that error is set by **the same** Workspace admin
  console (`admin.google.com` on the primary domain), typically App access
  control (the OAuth client must be Trusted) or an OU-scoped block if Eugenia
  staff sit in a stricter organizational unit — not a separate Eugenia tenant.

## Related

- [2026-07-02-auth-identity-session-and-policy.md](./2026-07-02-auth-identity-session-and-policy.md)
- `packages/auth/src/auth.ts`
