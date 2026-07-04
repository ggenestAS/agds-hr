CREATE TYPE "people"."check_in_status" AS ENUM('on_track', 'off_track');--> statement-breakpoint
CREATE TABLE "people"."check_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_email" text NOT NULL,
	"period" text NOT NULL,
	"status" "people"."check_in_status",
	"summary" text DEFAULT '' NOT NULL,
	"p1_confirmed" boolean DEFAULT false NOT NULL,
	"p1_note" text DEFAULT '' NOT NULL,
	"promo_flag" boolean DEFAULT false NOT NULL,
	"promo_note" text DEFAULT '' NOT NULL,
	"underperf_flag" boolean DEFAULT false NOT NULL,
	"underperf_note" text DEFAULT '' NOT NULL,
	"author_email" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_subject_period" UNIQUE("subject_email","period")
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."check_in" TO "admin_role";--> statement-breakpoint
GRANT SELECT ON "people"."check_in" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "people"."check_in" TO "readonly_role";
