import { useRouterState } from "@tanstack/react-router";

import { cn } from "../lib/cn.ts";

// Thin indeterminate bar for the in-between (§9.1): covers the sub-150ms
// window where the old page is still on screen and no route skeleton has
// appeared yet, so the click visibly registered. Comparing location.href with
// resolvedLocation.href limits it to client-side navigations — it never shows
// during initial SSR hydration.
export function NavigationProgress() {
  const navigating = useRouterState({
    select: (state) =>
      (state.isLoading || state.status === "pending") &&
      state.location.href !== state.resolvedLocation?.href,
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-200",
        navigating ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="h-full w-1/3 rounded-full bg-[var(--color-accent)]"
        style={navigating ? { animation: "nav-progress 1s ease-in-out infinite" } : undefined}
      />
    </div>
  );
}
