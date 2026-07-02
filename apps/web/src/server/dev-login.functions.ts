import { createServerFn } from "@tanstack/react-start";

// Thin transport for the dev-login bypass; the impl (which touches the DB and
// sets the cookie) stays behind the lazy-import seam (§9.3).
export const devLoginFn = createServerFn({ method: "POST" }).handler(async () => {
  const { devLoginHandler } = await import("./dev-login.impl.server.ts");
  return devLoginHandler();
});

export const devLoginEnabledFn = createServerFn({ method: "GET" }).handler(async () => {
  const { isDevLoginEnabled } = await import("./dev-login.impl.server.ts");
  return { enabled: isDevLoginEnabled() };
});

export const devLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { devLogoutHandler } = await import("./dev-login.impl.server.ts");
  return devLogoutHandler();
});
