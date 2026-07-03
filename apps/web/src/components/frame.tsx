import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { authClient } from "../lib/auth-client.ts";
import { cn } from "../lib/cn.ts";
import { useTheme } from "../lib/use-theme.ts";
import type { ThemePreference } from "../lib/theme.ts";
import { devLogoutFn } from "../server/dev-login.functions.ts";
import type { NavHints } from "../server/people.shared.ts";

// The authenticated frame (docs/new-project-directives.md §9.4), restyled to the
// imported design: dark ink sidebar with grouped, role-filtered navigation
// (Review cycle / Compensation / Governance). Navigation is real <Link> anchors
// (enforced by check:nav). The body never scrolls — the content pane does.

// Which product roles see which nav item, mirroring the design's role views
// (leadership = admin/founder/developer; managers add the review-flow surfaces;
// everyone gets the cycle basics).
const LEADERSHIP = ["admin", "founder", "developer"] as const;
const REVIEWERS = ["manager", ...LEADERSHIP] as const;
const EVERYONE = ["staff", ...REVIEWERS] as const;
const DEVELOPER = ["developer"] as const;

type NavEntry = {
  readonly to:
    | "/dashboard"
    | "/people"
    | "/self-review"
    | "/peer-input"
    | "/assessment"
    | "/calibration"
    | "/sign-off"
    | "/appeals"
    | "/compensation"
    | "/bands"
    | "/documentation"
    | "/audit"
    | "/roles";
  readonly label: string;
  readonly roles: readonly string[];
};

const NAV_GROUPS: readonly { readonly header: string; readonly items: readonly NavEntry[] }[] = [
  {
    header: "Review cycle",
    items: [
      { to: "/dashboard", label: "Overview", roles: EVERYONE },
      { to: "/people", label: "People", roles: EVERYONE },
      { to: "/self-review", label: "Self-review", roles: EVERYONE },
      { to: "/peer-input", label: "Peer input", roles: EVERYONE },
      { to: "/assessment", label: "Assessment", roles: REVIEWERS },
      { to: "/calibration", label: "Calibration", roles: REVIEWERS },
      { to: "/sign-off", label: "Decision & sign-off", roles: LEADERSHIP },
    ],
  },
  {
    header: "Compensation",
    items: [
      // Principles/merit-matrix only, no amounts or bands — every manager
      // needs this to write sound comp recommendations. Bands stay leadership.
      { to: "/compensation", label: "Compensation", roles: REVIEWERS },
      { to: "/bands", label: "Salary bands", roles: LEADERSHIP },
    ],
  },
  {
    header: "Governance",
    items: [
      { to: "/appeals", label: "Appeals", roles: EVERYONE },
      { to: "/documentation", label: "Documentation", roles: LEADERSHIP },
      { to: "/audit", label: "Audit log", roles: LEADERSHIP },
      { to: "/roles", label: "Roles", roles: DEVELOPER },
    ],
  },
];

const THEME_CYCLE: readonly ThemePreference[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemePreference, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

export type FrameUser = {
  readonly email: string;
  readonly roles: readonly string[];
};

const initials = (email: string): string => {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter((part) => part.length > 0);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

export function Frame({
  user,
  navHints,
  header,
  children,
}: {
  user: FrameUser;
  navHints: NavHints;
  header?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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

  // An authenticated user with no explicit grants is the baseline staff
  // experience — policies already treat them that way (directory read etc.),
  // so the nav does too. Matters for freshly-provisioned users and for
  // founders impersonating roster members who have never signed in.
  const effectiveRoles = user.roles.length > 0 ? user.roles : ["staff"];
  const visibleGroups = NAV_GROUPS.map((group) => ({
    header: group.header,
    items: group.items.filter((item) => item.roles.some((role) => effectiveRoles.includes(role))),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={cn(
          "flex flex-col bg-ink-900 text-white transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <span className="inline-block size-3 shrink-0 rounded-full bg-primary" />
          {!collapsed && (
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              Albert <span className="text-white/60">People</span>
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
          {visibleGroups.map((group) => (
            <div key={group.header} className="flex flex-col gap-0.5">
              {!collapsed && (
                <div className="px-3 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  {group.header}
                </div>
              )}
              {group.items.map((item) => {
                const showNavBadge =
                  !pathname.startsWith(item.to) &&
                  ((item.to === "/self-review" && navHints.selfReviewAction) ||
                    (item.to === "/peer-input" && navHints.peerInputAction));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "relative rounded-[10px] px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5",
                      !collapsed && showNavBadge && "flex items-center justify-between gap-2",
                    )}
                    activeProps={{ className: "bg-[rgba(233,75,60,0.16)] text-white" }}
                  >
                    {collapsed ? item.label.charAt(0) : item.label}
                    {showNavBadge && (
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full bg-primary",
                          collapsed && "absolute right-2 top-2",
                        )}
                        aria-label={
                          item.to === "/self-review"
                            ? "Self-review in progress"
                            : "Peer input action needed"
                        }
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-white/10 p-2">
          {!collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {initials(user.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">
                  {user.email}
                </span>
                <span className="block text-[11px] text-white/50">
                  {user.roles.join(", ") || "no role"}
                </span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={nextTheme}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-white/50 transition-colors hover:bg-white/5"
          >
            {collapsed ? THEME_LABEL[preference].charAt(0) : `Theme: ${THEME_LABEL[preference]}`}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-white/50 transition-colors hover:bg-white/5"
          >
            {collapsed ? "»" : "« Collapse"}
          </button>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="rounded-[10px] px-3 py-2 text-left text-xs font-medium text-white/50 transition-colors hover:bg-white/5"
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
