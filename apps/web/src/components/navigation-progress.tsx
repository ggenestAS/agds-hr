import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { cn } from "../lib/cn.ts";

// Thin indeterminate bar for the in-between (§9.1): covers the sub-150ms
// window where the old page is still on screen and no route skeleton has
// appeared yet, so the click visibly registered.
export function NavigationProgress() {
  const routerNavigating = useRouterState({
    select: (state) =>
      (state.isLoading || state.status === "pending") &&
      state.location.href !== state.resolvedLocation?.href,
  });
  // Off until mounted: streaming SSR can render mid-navigation (status
  // "pending"), which would ship an animating bar whose attributes hydration
  // never patches back off — a red line running forever over a loaded page.
  // Server and first client render both say "off"; real client-side
  // navigations drive it from there.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const navigating = mounted && routerNavigating;

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
