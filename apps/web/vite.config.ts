import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TanStack Start on Vite + Nitro (docs/new-project-directives.md §2). The
// React Refresh plugin must follow tanstackStart (the framework relies on it
// for dev HMR). Tailwind v4 is CSS-first — no config file, tokens live in
// src/styles/app.css.
export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
