ALTER TYPE "people"."peer_request_status" ADD VALUE 'proposed';--> statement-breakpoint
ALTER TABLE "people"."assessment" ADD COLUMN "author_email" text;