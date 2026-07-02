CREATE TABLE "people"."review_signoff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"founder_user_id" uuid NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_signoff_case_founder" UNIQUE("case_id","founder_user_id")
);
--> statement-breakpoint
ALTER TABLE "people"."review_case" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people"."review_case" ADD COLUMN "appeal_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people"."review_case" ADD COLUMN "p6_triggered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."review_signoff" ADD CONSTRAINT "review_signoff_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."review_signoff" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."review_signoff" TO app_role, readonly_role;
