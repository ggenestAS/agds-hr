CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_id" text,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"request_id" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_subject_created_idx" ON "audit"."events" ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_actor_created_idx" ON "audit"."events" ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_domain_type_idx" ON "audit"."events" ("domain","event_type");--> statement-breakpoint
GRANT USAGE ON SCHEMA "audit" TO app_role, admin_role, readonly_role;
--> statement-breakpoint
GRANT INSERT, SELECT ON "audit"."events" TO app_role, admin_role;
--> statement-breakpoint
GRANT SELECT ON "audit"."events" TO readonly_role;
--> statement-breakpoint
CREATE FUNCTION "audit".forbid_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Append-only compliance record: application roles cannot mutate it even
  -- if grants drift. Only the test reset sets the transaction-local sentinel
  -- (docs/decisions/2026-07-02-database-roles-and-migrations.md).
  IF current_setting('agds_hr.allow_audit_reset', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'audit_append_only: % on audit.events is forbidden', TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER events_forbid_mutation
BEFORE UPDATE OR DELETE ON "audit"."events"
FOR EACH ROW EXECUTE FUNCTION "audit".forbid_event_mutation();
--> statement-breakpoint
CREATE TRIGGER events_forbid_truncate
BEFORE TRUNCATE ON "audit"."events"
FOR EACH STATEMENT EXECUTE FUNCTION "audit".forbid_event_mutation();
