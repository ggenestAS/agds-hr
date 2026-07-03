-- Custom SQL migration file, put your code below! --

-- Seed the design's country coefficients (France reference = 1.00x), stored as
-- basis points. Idempotent: existing rows (possibly hand-tuned) are left alone.
INSERT INTO "people"."country_coefficient" ("country", "coefficient_bp") VALUES
  ('France', 10000),
  ('Spain', 8500),
  ('Italy', 9200),
  ('Switzerland', 13500)
ON CONFLICT ("country") DO NOTHING;
