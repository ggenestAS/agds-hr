Status: in progress
Readiness: ready

# apps/web shell + design system plan

Bootstrap step 6 (new-project-directives.md §17, §9). Depends on step 5
(auth + identity), which is built. This is the frame every "Albert People"
surface sits in; the product domain itself is step 10.

## Goal

Stand up the one TanStack Start app: document shell, authenticated layout with
the session gate, sign-in, the server-fn triple pattern, the shadcn primitive
set themed with Albert brand tokens, the telemetry stream, and the two app
convention gates. No product surfaces yet — those are step 10.

## Scope

### In

- `apps/web` scaffold: TanStack Start (+ Router) on rolldown-vite + Nitro,
  React 19, `tsr generate` wired as postinstall, `routeTree.gen.ts` gitignored.
- `__root.tsx` shell (theme FOUC script, `@font-face`, TooltipProvider,
  Toaster, error boundary, `h-dvh overflow-hidden` body); `_app.tsx`
  authenticated layout (`beforeLoad` loads the session via `resolveSession`,
  redirects to `/sign-in?from=` when absent, gates feature flags).
- BetterAuth catch-all `src/routes/api/auth.$.ts` wiring `getAuth()`; the
  composition root `src/server/policies.ts` registering identity predicates
  (idempotent via the bootstrap probe); the injected `SessionDeps` wired to
  identity's `hydrateUser`/`readActiveImpersonation` on the admin connection.
- Sign-in page (SSO button only); `useTheme()` (light/dark/system).
- The server-fn triple for identity (`identity.shared.ts` / `.functions.ts` /
  `.impl.server.ts`) with `requireSession`/`auditContext` helpers and the
  `instrumentServerFn` telemetry decorator — the reference the product copies.
- `packages/domains/telemetry` (append-only `telemetry.event`) — the deferred
  trigger fires here (first server-fn boundary to instrument).
- shadcn on Tailwind v4 (CSS-first) themed with Albert tokens (below), `cva`
  variants, `cn()`; primitives needed by the shell (Button, Card, Input,
  Dialog, Tooltip, Sonner).
- New CI gates with co-located tests: `check:nav` (no `onClick={() =>
  navigate()}`), `check:client-barrels` (no domain-barrel value imports in
  client-scanned files).

### Out (with named triggers)

- Any "Albert People" product surface (directory, review cycle, calibration,
  comp, appeals) — step 10, its own plan.
- `magicLink` audience; MFA — charter triggers unchanged.
- Full 100% coverage gate — step 7.
- Production run/deploy target — the Nitro preset + Vercel output + `start`
  script are deferred to the deploy-wiring increment; `vite build` currently
  emits `dist/` (client + SSR), not the `.output/` server bundle §2 expects.

## Data model

`telemetry.event` (append-only, §10): route page views, `server_action` wide
events, frontend errors, external-call summaries; typed error columns;
`requestId` joins it to `audit.events`. `recordEvent` never throws, emitted via
`waitUntil`.

## Design system — shadcn themed with Albert brand tokens

Decision (to be frozen as an ADR when built): keep the DNA's shadcn/cva
architecture and variant discipline (§9.4), but replace the neutral OKLCH
palette and IBM Plex fonts with Albert's brand tokens. This is a deliberate §2
deviation for brand fidelity; the architecture (the non-negotiable part) is
unchanged. Tokens sourced verbatim from the imported design's
`colors_and_type.css` (Albert School design system):

- **Inks (text):** ink-900 `#202448` (primary navy), 700 `#2E3260`, 500
  `#5B5F84`, 300 `#9FA2BA`, 100 `#D8D9E4`.
- **Surfaces:** shell `#FAF7F1` (page bg), cream `#F6F2EA`, bone `#F1ECE2`,
  paper `#FFFFFF`, slate `#EFEEF1`.
- **Accent (primary):** red `#E94B3C`, dark `#C73A2D`, coral `#F5A28F`, blush
  `#F3D9D2`.
- **Borders:** soft `rgba(32,36,72,.08)`, mid `rgba(32,36,72,.18)`, strong
  `#202448`.
- **Type:** display `General Sans`→Manrope fallback; body `Manrope`; serif
  accent `Instrument Serif`; mono `JetBrains Mono`. Self-host woff2 (§2), CDN
  only as a dev fallback; flag that Albert's true font files aren't provided.
- **Radii** xs4/sm8/md14/lg20/xl28/pill; **shadows** light (brand reads crisp
  borders, not elevation); **motion** standard `cubic-bezier(.2,0,0,1)` /
  emphasised `cubic-bezier(.16,1,.3,1)`, fast 160 / base 280 / slow 520ms.
- Map to shadcn semantic tokens: `--primary` = accent-red, `--background` =
  shell, `--card` = paper, `--foreground` = ink-900, `--muted-foreground` =
  ink-500, `--border` = border-mid, `--radius` = md. Add `warning` (§9.4);
  defer `success`/`info` until a surface needs them (charter trigger).

## Policies

Composition root registers the identity predicates from step 5
(`identity.profile.update`, `identity.user.deactivate`, `identity.role.grant`,
`identity.impersonation.start`) adapting the typed-resource predicates to the
registry's `(user, resource?)` handler shape.

## Surfaces

Frame (collapsible nav + page-header bar) wrapping the seven content shapes
(§9.4); no product surface yet. Sign-in is outside the shell. The design's
"Viewing as" switch consumes step 5's impersonation once the developer surface
lands.

## Open questions

- Self-hosted font files: Albert's true General Sans/Manrope files aren't
  provided; ship Fontshare/Google woff2 as a near-match and flag for
  replacement, or pick IBM Plex after all? Default: near-match woff2, flagged.
- Route audience groups present at step 6 (`_app.me`, `_app.developer`) vs
  waiting for step 10 — default: scaffold `_app.developer` (impersonation lives
  there) + `_app.me`, leave product groups to step 10.
