import { setCookie } from "@tanstack/react-start/server";

import { getDbAs } from "@agds-hr/db";
import { readOptional, type EnvSource } from "@agds-hr/env";
import { ensureUserByEmail, grantRole } from "@agds-hr/identity";
import { RequestId, type UserId } from "@agds-hr/shared";

// Local dev-login bypass so the authenticated frame can be viewed without Google
// SSO. Fail closed: everything here no-ops unless DEV_LOGIN === "1", which is
// never set in production. The dev cookie names the user directly; resolveSession
// honors it only under the same flag (session.impl.server.ts).
export const DEV_LOGIN_COOKIE = "agds_dev_user";
const DEV_EMAIL = "dev@albertschool.com";

export function isDevLoginEnabled(env: EnvSource = process.env): boolean {
  return readOptional("DEV_LOGIN", env) === "1";
}

async function ensureDevUser(): Promise<UserId> {
  const db = getDbAs("admin");
  const id = await ensureUserByEmail(db, DEV_EMAIL, "Dev User");
  const context = { actorUserId: id, subjectUserId: id, requestId: RequestId(crypto.randomUUID()) };
  await grantRole(db, id, "developer", context);
  await grantRole(db, id, "staff", context);
  return id;
}

export async function devLoginHandler(): Promise<{ readonly ok: boolean }> {
  if (!isDevLoginEnabled()) {
    return { ok: false };
  }
  const id = await ensureDevUser();
  setCookie(DEV_LOGIN_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  return { ok: true };
}

// Clears the dev cookie (part of sign-out). Safe to call regardless of the flag.
export function devLogoutHandler(): { readonly ok: boolean } {
  setCookie(DEV_LOGIN_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
  return { ok: true };
}
