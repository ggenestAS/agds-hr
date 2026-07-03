CREATE TYPE "people"."employment_type" AS ENUM('employee', 'apprentice', 'vie', 'intern', 'freelance');--> statement-breakpoint
CREATE TYPE "people"."review_participation" AS ENUM('included', 'excluded');--> statement-breakpoint
ALTER TABLE "people"."employee" ADD COLUMN "employment_type" "people"."employment_type" DEFAULT 'employee'::"people"."employment_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "people"."employee" ADD COLUMN "review_participation_override" "people"."review_participation";