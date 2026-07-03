-- Custom SQL migration file, put your code below! --

-- Simplify the band model to two families per level: jobs with a HIGH variable
-- component (commercial roles — lower base, variable plan on top) and jobs
-- with a LOW variable component (base carries the compensation). Replaces the
-- earlier per-department seed; rows already using the two families (e.g.
-- founder edits) are preserved by the DO NOTHING insert.
DELETE FROM "people"."band" WHERE "role_family" IN
  ('Admissions', 'Academic', 'Finance', 'Marketing', 'Partnerships', 'Campus Ops', 'Student Success');

INSERT INTO "people"."band" ("role_family", "level", "min_eur", "mid_eur", "max_eur") VALUES
  ('Low variable',  'L1', 34000, 39000, 46000),
  ('Low variable',  'L2', 42000, 48000, 58000),
  ('Low variable',  'L3', 52000, 60000, 72000),
  ('Low variable',  'L4', 64000, 74000, 88000),
  ('High variable', 'L1', 30000, 35000, 42000),
  ('High variable', 'L2', 38000, 44000, 53000),
  ('High variable', 'L3', 47000, 54000, 65000),
  ('High variable', 'L4', 58000, 67000, 80000)
ON CONFLICT ("role_family", "level") DO NOTHING;
