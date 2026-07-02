import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDbAs } from "@agds-hr/db";
import { readOptional, readRequired, type EnvSource } from "@agds-hr/env";

import * as authDbSchema from "./db/schema.ts";

// The workspace allow-list is a hardcoded constant, never an env var: the code
// is the system of record and env-configurable allow-lists drift
// (docs/new-project-directives.md §6.1). Personal accounts never complete
// sign-in regardless of provisioning.
export const WORKSPACE_ALLOWED_DOMAINS = ["albertschool.com"] as const;

export function isWorkspaceDomainAllowed(hd: string | null | undefined): boolean {
  return typeof hd === "string" && (WORKSPACE_ALLOWED_DOMAINS as readonly string[]).includes(hd);
}

type BuildConfig = {
  readonly secret: string;
  readonly baseURL: string | undefined;
  readonly googleId: string | undefined;
  readonly googleSecret: string | undefined;
};

function buildAuth(config: BuildConfig) {
  return betterAuth({
    secret: config.secret,
    ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
    // BetterAuth runs on the admin connection; it owns the auth schema.
    database: drizzleAdapter(getDbAs("admin"), { provider: "pg", schema: authDbSchema }),
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    // SSO-only: no credentials, no self-service sign-up.
    emailAndPassword: { enabled: false },
    // App-owned columns, mirrored on auth.user; not user-writable via the API.
    user: {
      additionalFields: {
        displayName: { type: "string", required: false, input: false },
        deactivatedAt: { type: "date", required: false, input: false },
      },
    },
    socialProviders:
      config.googleId !== undefined && config.googleSecret !== undefined
        ? {
            google: {
              clientId: config.googleId,
              clientSecret: config.googleSecret,
              disableSignUp: true,
              disableImplicitSignUp: true,
            },
          }
        : {},
    // Block email/password paths and the profile-write path so profile edits
    // cannot bypass the domain DAL's policy+audit path (§6.1).
    disabledPaths: ["/sign-in/email", "/sign-up/email", "/update-user"],
    databaseHooks: {
      user: {
        create: {
          // The security boundary: reject unverified emails and any workspace
          // domain outside the allow-list, with snake_case codes (§6.1). We gate
          // on the verified email domain; step 6 tightens this to the id_token
          // `hd` claim when the live provider is wired.
          before: async (candidate: {
            readonly email: string;
            readonly emailVerified: boolean;
          }) => {
            if (candidate.emailVerified !== true) {
              throw new Error("google_email_unverified");
            }
            if (!isWorkspaceDomainAllowed(candidate.email.split("@")[1])) {
              throw new Error("google_workspace_mismatch");
            }
            return { data: candidate };
          },
        },
      },
    },
  });
}

// Lazily built and cached so type-only importers pay no env/DB cost and nothing
// fails at import (§6.1). Nothing connects until first call.
type Auth = ReturnType<typeof buildAuth>;
let cached: Auth | undefined;

export function getAuth(env: EnvSource = process.env): Auth {
  if (cached !== undefined) {
    return cached;
  }
  const instance = buildAuth({
    secret: readRequired("BETTER_AUTH_SECRET", env),
    baseURL: readOptional("BETTER_AUTH_URL", env),
    googleId: readOptional("GOOGLE_CLIENT_ID", env),
    googleSecret: readOptional("GOOGLE_CLIENT_SECRET", env),
  });
  cached = instance;
  return instance;
}

// Test-only escape hatch — production never calls this.
export function __resetAuthForTests(): void {
  cached = undefined;
}
