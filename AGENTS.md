# agds-hr — operating rules

Thin always-on rules for humans and agents. Area-specific rules live in nested
AGENTS.md files (added as each area lands). Substantive rule changes need a
decision file in `docs/decisions/`.

## Orientation

- `docs/CHARTER.md` is the live source of truth: scope, pinned decisions, the
  deferred table with named triggers.
- `docs/new-project-directives.md` is the frozen founding document — the full
  DNA (stack, architecture, idioms). When in doubt about a pattern, it wins.
- Every supported command is `bun run <alias>` from the repo root, catalogued
  in `scripts/README.md`.

## Hard rules

- The codebase is the system of record. Decisions land in the repo as code or
  markdown — never only in a chat thread, PR comment, or external tool.
- Fail closed. A check that can't run answers "no".
- Boundaries are mechanisms: when you adopt a convention, write its checker in
  `scripts/ci/` in the same PR. A convention without a gate is a suggestion.
- Package `src/index.ts` barrels are the only public boundary — explicit named
  re-exports, never `export *` (sole exception: `@agds-hr/shared`).
- Imports use explicit `.ts` extensions: `import { x } from "./dal.ts"`.
- Every mutation is audited in the same transaction (`recordEvent`).
- Never hand-edit `packages/db/migrations/*/snapshot.json`. Never simulate or
  bypass drizzle-kit's interactive create-vs-rename prompts — stop and ask.
  Hand-appending grants/triggers to a generated `migration.sql` is the normal
  path (grants ship with tables); touching snapshots is not.
- Errors are thrown, not returned, from the typed classes in
  `@agds-hr/shared`, with `snake_case:`-prefixed messages.
- Commit style: `type(scope): summary`, lowercase summaries. Stage only the
  paths you wrote — never `git add -A`/`.`. Never `--no-verify` without
  explicit human authorization. Never `git stash`, `git reset --hard`, or
  broad `git restore` on paths you didn't write.
- Doc drift: the code is the lock — fix the doc (or the code) in the same
  commit. Renamed a file other docs reference? `rg <old-name> docs/ README.md
AGENTS.md` must return nothing.
- Comments explain _why_ (trade-offs, fail-closed reasoning, workarounds with
  upstream links) and cite decision files by name. Never comments that narrate
  what the next line does. No emojis in committed prose.
