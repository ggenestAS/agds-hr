CREATE TYPE "people"."peer_kind" AS ENUM('lt', 'team', 'cross');--> statement-breakpoint
CREATE TYPE "people"."peer_request_status" AS ENUM('pending', 'submitted', 'declined');--> statement-breakpoint
CREATE TABLE "people"."assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL CONSTRAINT "assessment_case" UNIQUE,
	"dims" jsonb DEFAULT '{}' NOT NULL,
	"narrative" text DEFAULT '' NOT NULL,
	"proposed_rating" integer,
	"promo_proposed" boolean DEFAULT false NOT NULL,
	"comp_rec" text DEFAULT '' NOT NULL,
	"p6_acknowledged" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people"."peer_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"requestee_email" text NOT NULL,
	"kind" "people"."peer_kind" NOT NULL,
	"status" "people"."peer_request_status" DEFAULT 'pending'::"people"."peer_request_status" NOT NULL,
	"decline_reason" text,
	"input" jsonb DEFAULT '{}' NOT NULL,
	"requested_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peer_request_case_requestee" UNIQUE("case_id","requestee_email")
);
--> statement-breakpoint
CREATE TABLE "people"."self_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL CONSTRAINT "self_review_case" UNIQUE,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people"."assessment" ADD CONSTRAINT "assessment_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "people"."peer_request" ADD CONSTRAINT "peer_request_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "people"."self_review" ADD CONSTRAINT "self_review_case_id_review_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "people"."review_case"("id") ON DELETE CASCADE;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."self_review" TO "admin_role";--> statement-breakpoint
GRANT SELECT ON "people"."self_review" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "people"."self_review" TO "readonly_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."peer_request" TO "admin_role";--> statement-breakpoint
GRANT SELECT ON "people"."peer_request" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "people"."peer_request" TO "readonly_role";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."assessment" TO "admin_role";--> statement-breakpoint
GRANT SELECT ON "people"."assessment" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "people"."assessment" TO "readonly_role";
