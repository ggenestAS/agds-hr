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

| Alias                  | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `check:docs`           | Decision index / status banners / plan lifecycle fields are consistent |
| `check:migrations`     | Migration snapshot chain is strictly linear                            |
| `check:env`            | ENV_MANIFEST ↔ `.env.example` ↔ actual env reads — no three-way drift  |
| `check:nav`            | Navigation renders `<Link>` anchors — no onClick navigate()            |
| `check:client-barrels` | Package barrels stay explicit named re-exports                         |
| `check:theme`          | No raw hex colors in web markup — theme tokens with `.dark` overrides  |

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

| Alias         | What it does                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `dev`         | Local Vite dev server (**Node ≥22.12** via `scripts/dev/vite.mjs`; auto-finds `~/.nvm` if apt Node is older) |
| `build`       | Production build of `@agds-hr/web` (Cloudflare Worker; requires Node ≥22.12)                                 |
| `deploy`      | Build + `wrangler deploy` to Cloudflare Workers                                                              |
| `deploy:prod` | Sync secrets from `.env`, build, deploy to `hr.albertschool.com`                                             |

**CI auto-deploy:** pushing to `main` runs `ci` first; on success,
`.github/workflows/deploy.yml` runs `scripts/ops/deploy-worker.ts` against
production. Configure these GitHub repository secrets (Settings → Secrets →
Actions):

| Secret                 | Required                                      |
| ---------------------- | --------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | yes — Workers Scripts:Edit + Hyperdrive:Edit  |
| `BETTER_AUTH_SECRET`   | yes                                           |
| `GOOGLE_CLIENT_ID`     | yes (warn-only locally if unset; CI needs it) |
| `GOOGLE_CLIENT_SECRET` | yes                                           |
| `INSIDE_API_KEY`       | no — directory sync still manual              |

Manual redeploy without a push: Actions → **deploy** → **Run workflow**.
| `preview` | Local preview of the production Worker bundle |
| `lint` | `oxlint --type-aware --type-check` over the tree |
| `lint:staged` | oxlint over staged files + 1-hop reverse import closure |
| `format` | `oxfmt` over the tree |
| `format:check` | `oxfmt --check` |
| `knip` | Dead-code report (advisory, not gated) |
