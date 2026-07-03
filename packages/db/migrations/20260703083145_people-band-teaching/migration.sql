-- Custom SQL migration file, put your code below! --

-- Full-time teachers join the band model as a third family (decision: the
-- England 2013-14 model — performance-related progression within pay ranges,
-- appraisal-based, no automatic seniority steps). The 32k–52k corridor is
-- split into overlapping level ranges; movement WITHIN a range follows the
-- merit matrix off the annual review, movement BETWEEN levels is the normal
-- promotion route (assessment -> calibration -> dual founder sign-off).
-- Founder-editable like every band; existing rows preserved.
INSERT INTO "people"."band" ("role_family", "level", "min_eur", "mid_eur", "max_eur") VALUES
  ('Teaching', 'L1', 32000, 34000, 37000),
  ('Teaching', 'L2', 35000, 38000, 42000),
  ('Teaching', 'L3', 40000, 44000, 48000),
  ('Teaching', 'L4', 46000, 49000, 52000)
ON CONFLICT ("role_family", "level") DO NOTHING;
