CREATE TABLE "people"."comp_recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL CONSTRAINT "comp_recommendation_case" UNIQUE,
	"current_base_eur" integer NOT NULL,
	"increase_eur" integer DEFAULT 0 NOT NULL,
	"bonus_eur" integer DEFAULT 0 NOT NULL,
	"new_base_eur" integer NOT NULL,
	"effective_date" text,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people"."comp_recommendation" ADD CONSTRAINT "comp_recommendation_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."comp_recommendation" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."comp_recommendation" TO app_role, readonly_role;
