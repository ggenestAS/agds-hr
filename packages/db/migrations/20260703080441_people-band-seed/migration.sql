-- Custom SQL migration file, put your code below! --

-- Seed France-reference salary bands per role family x level (whole EUR).
-- Figures follow the imported design's examples (Admissions L1/L4, Finance L3,
-- Partnerships L2, Campus Ops L4) with a consistent generic ladder for the
-- rest. Founders maintain them from the Salary bands surface; existing rows
-- are left alone (idempotent).
INSERT INTO "people"."band" ("role_family", "level", "min_eur", "mid_eur", "max_eur") VALUES
  ('Admissions',      'L1', 34000, 39000, 46000),
  ('Admissions',      'L2', 42000, 48000, 58000),
  ('Admissions',      'L3', 52000, 60000, 72000),
  ('Admissions',      'L4', 68000, 78000, 92000),
  ('Academic',        'L1', 34000, 39000, 46000),
  ('Academic',        'L2', 42000, 48000, 58000),
  ('Academic',        'L3', 52000, 60000, 72000),
  ('Academic',        'L4', 64000, 74000, 88000),
  ('Finance',         'L1', 34000, 39000, 46000),
  ('Finance',         'L2', 42000, 48000, 58000),
  ('Finance',         'L3', 52000, 60000, 72000),
  ('Finance',         'L4', 64000, 74000, 88000),
  ('Marketing',       'L1', 34000, 39000, 46000),
  ('Marketing',       'L2', 40000, 46000, 55000),
  ('Marketing',       'L3', 50000, 58000, 69000),
  ('Marketing',       'L4', 62000, 71000, 84000),
  ('Partnerships',    'L1', 36000, 41000, 48000),
  ('Partnerships',    'L2', 54000, 62000, 74000),
  ('Partnerships',    'L3', 58000, 66000, 78000),
  ('Partnerships',    'L4', 66000, 76000, 90000),
  ('Campus Ops',      'L1', 32000, 37000, 44000),
  ('Campus Ops',      'L2', 40000, 46000, 55000),
  ('Campus Ops',      'L3', 50000, 58000, 70000),
  ('Campus Ops',      'L4', 64000, 74000, 88000),
  ('Student Success', 'L1', 30000, 36000, 44000),
  ('Student Success', 'L2', 38000, 44000, 53000),
  ('Student Success', 'L3', 48000, 55000, 66000),
  ('Student Success', 'L4', 58000, 67000, 80000)
ON CONFLICT ("role_family", "level") DO NOTHING;
