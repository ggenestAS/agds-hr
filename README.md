# agds-hr

HR platform for Albert School. Bun workspaces monorepo on the keystone DNA:
TanStack Start, Drizzle on Neon Postgres, BetterAuth (SSO-only), schema-per-
domain packages, day-one audit, mechanical gates for every convention.

- **Start here:** [docs/CHARTER.md](docs/CHARTER.md) — live scope, pinned
  decisions, deferred table, bootstrap status.
- **The DNA:** [docs/new-project-directives.md](docs/new-project-directives.md)
  — the frozen founding document every structural decision traces to.
- **Operating rules:** [AGENTS.md](AGENTS.md).
- **Commands:** [scripts/README.md](scripts/README.md) — everything is
  `bun run <alias>` from the repo root.

## Setup

```sh
bun install                 # installs deps + wires lefthook hooks (prepare)
cp .env.example .env        # fill per the comments; nothing validates at import time
bun run db:migrate          # after scripts/db/setup-roles.sql ran once on the branch
```

Database is Neon Postgres (EU region), one branch per developer — no local
Docker. Create a branch, run `scripts/db/setup-roles.sql` on it as the project
owner, fill the five `DATABASE_URL*` vars.

## Layout

```
packages/
├── shared/          # branded ids, error types, PolicyDecision, role tuples — the only client-safe barrel
├── env/             # lazy env reads + typed ENV_MANIFEST
├── db/              # getDbAs() four-role selector, migrations/
└── domains/
    └── audit/       # append-only audit.events; recordEvent + listEvents
scripts/             # ci/ gates, db/ one-time SQL — see scripts/README.md
docs/                # CHARTER.md (live), decisions/ (frozen ADRs), plans/
```
