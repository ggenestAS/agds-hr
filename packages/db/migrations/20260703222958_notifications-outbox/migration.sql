CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"kind" text NOT NULL,
	"recipient_email" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"dedupe_key" text NOT NULL CONSTRAINT "outbox_dedupe_key" UNIQUE,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
GRANT USAGE ON SCHEMA "notifications" TO app_role, admin_role, readonly_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "notifications"."outbox" TO "admin_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "notifications"."outbox" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "notifications"."outbox" TO "readonly_role";
