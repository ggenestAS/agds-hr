// Pure theme-resolution core, shared by the FOUC-prevention inline script in
// __root.tsx and the hand-rolled useTheme hook (docs/new-project-directives.md
// §9.4 — light/dark/system, localStorage + matchMedia, `.dark` on <html>).
// Kept pure and DOM-free so it is unit-testable.
export const THEME_STORAGE_KEY = "agds-hr-theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const isThemePreference = (value: string): value is ThemePreference =>
  (THEME_PREFERENCES as readonly string[]).includes(value);

// Mirrors the inline FOUC script: an unset or unrecognized value is treated as
// "system", so it follows the OS preference until the user chooses explicitly.
export function resolveDark(stored: string | null, systemPrefersDark: boolean): boolean {
  const preference = stored !== null && isThemePreference(stored) ? stored : "system";
  return preference === "dark" || (preference === "system" && systemPrefersDark);
}
