import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { authClient } from "../lib/auth-client.ts";
import { cn } from "../lib/cn.ts";
import { useTheme } from "../lib/use-theme.ts";
import type { ThemePreference } from "../lib/theme.ts";
import { devLogoutFn } from "../server/dev-login.functions.ts";

// The authenticated frame (docs/new-project-directives.md §9.4): collapsible nav
// rail + compact page-header bar wrapping exactly one content shape. Navigation
// is real <Link> anchors (enforced by check:nav). The body never scrolls — the
// content pane does.
const NAV_ITEMS = [
  { to: "/people", label: "People" },
  { to: "/calibration", label: "Calibration" },
  { to: "/appeals", label: "Appeals" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

const THEME_CYCLE: readonly ThemePreference[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

export function Frame({ header, children }: { header?: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { preference, setPreference } = useTheme();

  const nextTheme = () =>
    setPreference(THEME_CYCLE[(THEME_CYCLE.indexOf(preference) + 1) % THEME_CYCLE.length]!);

  // Sign out clears both a real BetterAuth session and any dev cookie, then
  // returns to sign-in.
  const signOut = async () => {
    await authClient.signOut();
    await devLogoutFn();
    window.location.href = "/sign-in";
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-bone transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="inline-block size-3 shrink-0 rounded-full bg-primary" />
          {!collapsed && (
            <span className="font-display text-sm font-semibold tracking-tight">Albert People</span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-[rgba(233,75,60,0.08)]"
              activeProps={{ className: "bg-[rgba(233,75,60,0.14)] text-foreground" }}
            >
              {collapsed ? item.label.charAt(0) : item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-border p-2">
          <button
            type="button"
            onClick={nextTheme}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {collapsed ? THEME_LABEL[preference].charAt(0) : `Theme: ${THEME_LABEL[preference]}`}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {collapsed ? "»" : "« Collapse"}
          </button>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {collapsed ? "⎋" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="min-w-0">{header}</div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
