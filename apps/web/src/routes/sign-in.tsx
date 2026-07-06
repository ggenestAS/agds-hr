import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authClient } from "../lib/auth-client.ts";
import { Button } from "../components/ui/button.tsx";
import { devLoginEnabledFn, devLoginFn } from "../server/dev-login.functions.ts";

// Sign-in sits outside the authenticated shell. SSO-only: the sole production
// path is Google Workspace (docs/new-project-directives.md §6.1). The provider
// button activates once the BetterAuth catch-all route + OAuth credentials are
// wired; the dev-login button appears only when DEV_LOGIN=1 (local only).
const searchSchema = z.object({ from: z.string().optional() });

export const Route = createFileRoute("/sign-in")({
  validateSearch: searchSchema,
  loader: async () => ({ devLoginEnabled: (await devLoginEnabledFn()).enabled }),
  component: SignIn,
});

function SignIn() {
  const { devLoginEnabled } = Route.useLoaderData();

  const handleDevLogin = async () => {
    await devLoginFn();
    // Full reload so the new dev cookie is sent and the session resolves SSR.
    window.location.href = "/dashboard";
  };

  return (
    <main className="flex h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Albert School
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-foreground">
          Sign in to Albert People
        </h1>
        <Button
          type="button"
          size="lg"
          className="mt-8 w-full"
          onClick={() => {
            void authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
          }}
        >
          Continue with Google Workspace
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Access is restricted to albertschool.com and eugeniaschool.com accounts.
        </p>
        {devLoginEnabled && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              void handleDevLogin();
            }}
            className="mt-6 w-full"
          >
            Dev sign-in (local only)
          </Button>
        )}
      </div>
    </main>
  );
}
