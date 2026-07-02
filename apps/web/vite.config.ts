import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// TanStack Start on Vite + Nitro (docs/new-project-directives.md §2). The React
// Refresh plugin must follow tanstackStart. Tailwind v4 is CSS-first — tokens
// live in src/styles/app.css.
export default defineConfig(({ mode }) => {
  // Load the repo-root .env into process.env so the dev SSR/server-fn runtime
  // (which reads via @agds-hr/env → process.env) sees DATABASE_URL_* etc. — the
  // monorepo .env lives at the root, not this package. Assigned to process.env
  // (server-only), never to the client bundle: Vite only exposes VITE_-prefixed
  // vars to the client, so unprefixed secrets stay server-side. In production
  // the real environment (Vercel) supplies these.
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  Object.assign(process.env, loadEnv(mode, rootDir, ""));

  return {
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  };
});
