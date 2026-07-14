CREATE TABLE "people"."comp_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"employee_id" uuid NOT NULL,
	"effective_date" text NOT NULL,
	"comp_period" text NOT NULL,
	"base_salary_eur" integer NOT NULL,
	"variable_target_eur" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comp_record_employee_effective" UNIQUE("employee_id","effective_date")
);
--> statement-breakpoint
ALTER TABLE "people"."comp_record" ADD CONSTRAINT "comp_record_employee_id_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "people"."employee"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Backfill: the FY 2025-26 spreadsheet load previously lived as mutable columns
-- on employee. Preserve it as the first versioned record; the FY starts
-- 2025-09-01 (school year), which is the effective date of these packages.
INSERT INTO "people"."comp_record" ("employee_id", "effective_date", "comp_period", "base_salary_eur", "variable_target_eur")
SELECT "id", '2025-09-01', "comp_period", "base_salary_eur", "variable_target_eur"
FROM "people"."employee"
WHERE "comp_period" IS NOT NULL AND "base_salary_eur" IS NOT NULL AND "variable_target_eur" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."employee" DROP COLUMN "comp_period";--> statement-breakpoint
ALTER TABLE "people"."employee" DROP COLUMN "base_salary_eur";--> statement-breakpoint
ALTER TABLE "people"."employee" DROP COLUMN "variable_target_eur";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."comp_record" TO "admin_role";--> statement-breakpoint
GRANT SELECT ON "people"."comp_record" TO "app_role";--> statement-breakpoint
GRANT SELECT ON "people"."comp_record" TO "readonly_role";
