CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TYPE "identity"."role" AS ENUM('staff', 'developer');--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"display_name" text,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."impersonation_session" (
	"actor_user_id" uuid PRIMARY KEY,
	"subject_user_id" uuid NOT NULL,
	"reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."user_relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"related_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_relationship_edge" UNIQUE("user_id","related_user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "identity"."user_role" (
	"user_id" uuid,
	"role" "identity"."role",
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid NOT NULL,
	CONSTRAINT "user_role_pkey" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."impersonation_session" ADD CONSTRAINT "impersonation_session_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."impersonation_session" ADD CONSTRAINT "impersonation_session_subject_user_id_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."user_relationship" ADD CONSTRAINT "user_relationship_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."user_relationship" ADD CONSTRAINT "user_relationship_related_user_id_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."user_role" ADD CONSTRAINT "user_role_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Grants ship with the tables (docs/new-project-directives.md §5.2; ADR
-- 2026-07-02-auth-identity-session-and-policy). BetterAuth runs on admin_role
-- and owns the auth schema. Runtime roles (app/readonly) get column-level
-- SELECT on exactly the app-owned columns of auth.user — never
-- name/email/image (§6.1). Privileged identity mutations run on admin_role;
-- app/readonly only read identity tables.
GRANT USAGE ON SCHEMA "auth" TO admin_role, app_role, readonly_role;--> statement-breakpoint
GRANT USAGE ON SCHEMA "identity" TO admin_role, app_role, readonly_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "auth"."user" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "auth"."session" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "auth"."account" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "auth"."verification" TO admin_role;--> statement-breakpoint
GRANT SELECT ("id", "display_name", "deactivated_at") ON "auth"."user" TO app_role, readonly_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "identity"."user_role" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "identity"."user_relationship" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "identity"."impersonation_session" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "identity"."user_role" TO app_role, readonly_role;--> statement-breakpoint
GRANT SELECT ON "identity"."user_relationship" TO app_role, readonly_role;--> statement-breakpoint
GRANT SELECT ON "identity"."impersonation_session" TO app_role, readonly_role;