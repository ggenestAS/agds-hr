-- One-time per Neon branch, run as the project owner (DATABASE_URL_MIGRATE):
--   psql "$DATABASE_URL_MIGRATE" -f scripts/db/setup-roles.sql
--
-- Creates the four runtime login roles. Grants on schemas and tables ship
-- inside migrations, never here — see
-- docs/decisions/2026-07-02-database-roles-and-migrations.md. Passwords are
-- placeholders: set real ones per branch (ALTER ROLE ... PASSWORD) or let the
-- Neon console manage them, then fill the matching DATABASE_URL* vars.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role LOGIN PASSWORD 'change-me';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_role') THEN
    CREATE ROLE admin_role LOGIN PASSWORD 'change-me';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly_role') THEN
    CREATE ROLE readonly_role LOGIN PASSWORD 'change-me';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'webhook_role') THEN
    CREATE ROLE webhook_role LOGIN PASSWORD 'change-me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE neondb TO app_role, admin_role, readonly_role, webhook_role;
