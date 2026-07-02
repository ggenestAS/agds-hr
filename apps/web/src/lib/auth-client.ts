import { createAuthClient } from "better-auth/react";

// Browser auth client — baseURL defaults to the current origin, so it works on
// localhost, Render, and the custom domain without configuration. Used only to
// initiate the SSO redirect from the sign-in page; session resolution itself is
// server-side (resolveSession).
export const authClient = createAuthClient();
