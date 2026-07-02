CREATE TYPE "people"."review_state" AS ENUM('self_review', 'peer_input', 'manager_assessment', 'calibration', 'decision', 'appeal', 'closed');--> statement-breakpoint
CREATE TABLE "people"."review_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_email" text NOT NULL,
	"cycle_period" text NOT NULL,
	"state" "people"."review_state" DEFAULT 'self_review'::"people"."review_state" NOT NULL,
	"rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_case_subject_cycle" UNIQUE("subject_email","cycle_period")
);
--> statement-breakpoint
-- Grants (§5.2). Review mutations run on admin_role; app/readonly read (the
-- directory reads ratings on admin). Cases are the compliance record.
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."review_case" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."review_case" TO app_role, readonly_role;
