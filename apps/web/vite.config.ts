import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// TanStack Start on Vite + Cloudflare Workers (docs/decisions/2026-07-03-cloudflare-hosting.md).
// cloudflare() must precede tanstackStart(); React Refresh follows tanstackStart.
// Tailwind v4 is CSS-first — tokens live in src/styles/app.css.
export default defineConfig(({ mode }) => {
  // Load the repo-root .env into process.env so the dev SSR/server-fn runtime
  // (which reads via @agds-hr/env → process.env) sees DATABASE_URL_* etc. — the
  // monorepo .env lives at the root, not this package. Assigned to process.env
  // (server-only), never to the client bundle: Vite only exposes VITE_-prefixed
  // vars to the client, so unprefixed secrets stay server-side. In production
  // Cloudflare Workers secrets / dashboard env supply these.
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  Object.assign(process.env, loadEnv(mode, rootDir, ""));

  return {
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
