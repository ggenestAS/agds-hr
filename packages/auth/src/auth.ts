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

// Origins allowed to initiate auth (CSRF boundary). Hardcoded like the domain
// allow-list — the code is the system of record. baseURL (BETTER_AUTH_URL) is
// trusted implicitly; these cover local dev and production custom domain.
// Cloudflare *.workers.dev preview hostnames are covered via BETTER_AUTH_URL
// per environment — see docs/decisions/2026-07-03-cloudflare-hosting.md.
const TRUSTED_ORIGINS = ["http://localhost:5173", "https://hr.albertschool.com"] as const;

type BuildConfig = {
  readonly secret: string;
  readonly baseURL: string | undefined;
  readonly googleId: string | undefined;
  readonly googleSecret: string | undefined;
  readonly adminDb: ReturnType<typeof getDbAs>;
};

function buildAuth(config: BuildConfig) {
  return betterAuth({
    secret: config.secret,
    trustedOrigins: [...TRUSTED_ORIGINS],
    ...(config.baseURL !== undefined ? { baseURL: config.baseURL } : {}),
    // BetterAuth runs on the admin connection; it owns the auth schema.
    database: drizzleAdapter(config.adminDb, { provider: "pg", schema: authDbSchema }),
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    // SSO-only: no credentials, no self-service sign-up.
    emailAndPassword: { enabled: false },
    // Users are provisioned first (§6.1). On SSO, link the Google account to the
    // pre-provisioned user matched by verified email — Google Workspace email is
    // authoritative — rather than creating a new user (which disableSignUp blocks).
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
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

// Lazily built so type-only importers pay no env/DB cost and nothing fails at
// import (§6.1). The memo is keyed on the admin db instance, not module-level:
// on Cloudflare Workers getDbAs returns a fresh request-scoped db per request
// (sockets cannot cross requests), so the auth instance must follow it. In
// long-lived processes the db is stable, so this behaves like a singleton.
type Auth = ReturnType<typeof buildAuth>;
const cache = new WeakMap<object, Auth>();

export function getAuth(env: EnvSource = process.env): Auth {
  const adminDb = getDbAs("admin", env);
  const cached = cache.get(adminDb);
  if (cached !== undefined) {
    return cached;
  }
  const instance = buildAuth({
    secret: readRequired("BETTER_AUTH_SECRET", env),
    baseURL: readOptional("BETTER_AUTH_URL", env),
    googleId: readOptional("GOOGLE_CLIENT_ID", env),
    googleSecret: readOptional("GOOGLE_CLIENT_SECRET", env),
    adminDb,
  });
  cache.set(adminDb, instance);
  return instance;
}
