CREATE TYPE "people"."appeal_category" AS ENUM('rating', 'raise', 'band', 'exception');--> statement-breakpoint
CREATE TYPE "people"."appeal_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "people"."appeal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL CONSTRAINT "appeal_case" UNIQUE,
	"appellant_email" text NOT NULL,
	"category" "people"."appeal_category" NOT NULL,
	"statement" text NOT NULL,
	"status" "people"."appeal_status" DEFAULT 'open'::"people"."appeal_status" NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people"."appeal" ADD CONSTRAINT "appeal_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."appeal" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."appeal" TO app_role, readonly_role;
