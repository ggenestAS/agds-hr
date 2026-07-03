CREATE TABLE "people"."campus_coefficient" (
	"campus" text PRIMARY KEY,
	"coefficient_bp" integer NOT NULL
);
--> statement-breakpoint
DROP TABLE "people"."country_coefficient";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "people"."campus_coefficient" TO admin_role;--> statement-breakpoint
GRANT SELECT ON "people"."campus_coefficient" TO app_role, readonly_role;--> statement-breakpoint
-- Seed cost-of-living coefficients per campus (Paris reference = 1.00x, basis
-- points). Idempotent: hand-tuned rows are left alone.
INSERT INTO "people"."campus_coefficient" ("campus", "coefficient_bp") VALUES
  ('Paris', 10000),
  ('Marseille', 9000),
  ('Milan', 9200),
  ('Madrid', 8500),
  ('Geneva', 13500)
ON CONFLICT ("campus") DO NOTHING;
