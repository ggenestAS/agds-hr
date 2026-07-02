ALTER TABLE "people"."employee" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."employee" ADD COLUMN "inside_user_id" text;--> statement-breakpoint
ALTER TABLE "people"."employee" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."employee" ALTER COLUMN "country" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."employee" ALTER COLUMN "role_family" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_email_active" ON "people"."employee" ("email") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "people"."employee" DROP CONSTRAINT "employee_user_id_user_id_fkey", ADD CONSTRAINT "employee_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE SET NULL;