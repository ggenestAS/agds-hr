# scripts

Everything is `bun run <alias>` from the repo root. Directory roles:

| Directory | Role                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| `ci/`     | Permanent gates + test harness — run by lefthook and CI                              |
| `dev/`    | Worktree / db-profile / commit tooling (humans + agents) — pending, bootstrap step 8 |
| `ops/`    | Repeatable operator mutations (loaded with `.env`)                                   |
| `debug/`  | EPHEMERAL incident scripts — promote to `ops/` or delete                             |
| `lib/`    | Shared script helpers                                                                |
| `db/`     | One-time SQL (`setup-roles.sql`)                                                     |
| `data/`   | Static JSON snapshots for backfills                                                  |

## Commands

### Checks (`check:*`)

| Alias              | What it does                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| `check:docs`       | Decision index / status banners / plan lifecycle fields are consistent |
| `check:migrations` | Migration snapshot chain is strictly linear                            |
| `check:env`        | ENV_MANIFEST ↔ `.env.example` ↔ actual env reads — no three-way drift  |

### Tests (`test:*`)

| Alias         | What it does                                                              |
| ------------- | ------------------------------------------------------------------------- |
| `test`        | Full `bun test` (integration suites require the test-db sentinel, step 7) |
| `test:unit`   | Unit tests only — filters out `[integration]` describe blocks             |
| `test:staged` | Unit tests scoped to the packages touching staged files (pre-commit)      |

### Database (`db:*`)

| Alias         | What it does                                         |
| ------------- | ---------------------------------------------------- |
| `db:generate` | `drizzle-kit generate` — always `-- --name <slug>`   |
| `db:migrate`  | `drizzle-kit migrate` against `DATABASE_URL_MIGRATE` |

### Toolchain

| Alias          | What it does                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| `build`        | Production build of `@agds-hr/web` (Cloudflare Worker; requires Node ≥22.12) |
| `deploy`       | Build + `wrangler deploy` to Cloudflare Workers                              |
| `deploy:prod`  | Sync secrets from `.env`, build, deploy to `hr.albertschool.com`             |
| `preview`      | Local preview of the production Worker bundle                                |
| `lint`         | `oxlint --type-aware --type-check` over the tree                             |
| `lint:staged`  | oxlint over staged files + 1-hop reverse import closure                      |
| `format`       | `oxfmt` over the tree                                                        |
| `format:check` | `oxfmt --check`                                                              |
| `knip`         | Dead-code report (advisory, not gated)                                       |
