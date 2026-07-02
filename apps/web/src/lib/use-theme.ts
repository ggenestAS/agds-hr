import { useCallback, useEffect, useState } from "react";

import {
  isThemePreference,
  resolveDark,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme.ts";

// Hand-rolled theme hook (docs/new-project-directives.md §9.4 — not next-themes):
// localStorage + matchMedia, toggling `.dark` on <html>. The pure core lives in
// theme.ts (shared with the FOUC script) and is unit-tested there.
export function useTheme(): {
  readonly preference: ThemePreference;
  readonly setPreference: (next: ThemePreference) => void;
} {
  const [preference, setPref] = useState<ThemePreference>("system");

  // Hydrate from storage after mount (SSR renders the default).
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored !== null && isThemePreference(stored)) {
      setPref(stored);
    }
  }, []);

  // Apply the resolved class, and follow the OS while on "system".
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", resolveDark(preference, media.matches));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setPref(next);
  }, []);

  return { preference, setPreference };
}
