CREATE SCHEMA "people";
--> statement-breakpoint
CREATE TYPE "people"."career_level" AS ENUM('L1', 'L2', 'L3', 'L4');--> statement-breakpoint
CREATE TYPE "people"."career_path" AS ENUM('ic', 'manager');--> statement-breakpoint
CREATE TABLE "people"."band" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role_family" text NOT NULL,
	"level" "people"."career_level" NOT NULL,
	"min_eur" integer NOT NULL,
	"mid_eur" integer NOT NULL,
	"max_eur" integer NOT NULL,
	CONSTRAINT "band_family_level" UNIQUE("role_family","level")
);
--> statement-breakpoint
CREATE TABLE "people"."country_coefficient" (
	"country" text PRIMARY KEY,
	"coefficient_bp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people"."employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"level" "people"."career_level" NOT NULL,
	"path" "people"."career_path" NOT NULL,
	"country" text NOT NULL,
	"role_family" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "employee_user_active" ON "people"."employee" ("user_id") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "people"."employee" ADD CONSTRAINT "employee_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Grants ship with the tables (§5.2; ADR 2026-07-02-people-domain-model).
-- people tables carry no BetterAuth-owned columns, so app/readonly get table
-- SELECT (the directory read itself runs on admin, which joins auth.user).
GRANT USAGE ON SCHEMA "people" TO admin_role, app_role, readonly_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."employee" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."band" TO admin_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."country_coefficient" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."employee" TO app_role, readonly_role;--> statement-breakpoint
GRANT SELECT ON "people"."band" TO app_role, readonly_role;--> statement-breakpoint
GRANT SELECT ON "people"."country_coefficient" TO app_role, readonly_role;