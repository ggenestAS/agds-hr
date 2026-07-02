Status: frozen

# Stack and prerelease dependencies

Date: 2026-07-02

## Context

agds-hr starts from the keystone DNA ([new-project-directives.md](../new-project-directives.md)),
which pins the full stack and requires a decision record for any prerelease
dependency and for any deviation forced by the environment.

## Decision

Adopt the founding document's stack verbatim: Bun (workspaces, `bun test`,
pinned `1.3.x` in CI), TanStack Start on Vite + Nitro, Drizzle ORM on Neon
Postgres (EU) with the `postgres` driver, BetterAuth self-hosted, Zod v4
(workspace override), TanStack Query v5, shadcn on Tailwind v4, oxlint
(type-aware) + oxfmt, R2, Resend, Vercel, lefthook, knip (advisory).

Prerelease lines adopted now, because the stable line is the clear successor:

- `drizzle-orm@beta` / `drizzle-kit@beta` (the v1 line — relations API and
  strict snapshot chain are what the migration discipline is written against).

## Alternatives considered

- **Stay on drizzle 0.x stable** — Rejected because the founding document's
  conventions (relations registry, snapshot-chain checks) target the v1 line;
  adopting 0.x means migrating twice.
- **ESLint + Prettier instead of oxc** — Rejected because the founding
  document bans them; oxlint `--type-aware --type-check` replaces `tsc
--noEmit` and one toolchain is the point.

## Consequences

- Beta bumps can break; the lockfile pins exact versions and CI runs
  `--frozen-lockfile`.
- No separate `tsc` step exists; type errors surface through
  `bun run lint`.

## Related

- [new-project-directives.md §2](../new-project-directives.md)
- [2026-07-02-database-roles-and-migrations.md](./2026-07-02-database-roles-and-migrations.md)
