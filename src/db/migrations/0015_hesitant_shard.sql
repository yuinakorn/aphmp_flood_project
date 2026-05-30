CREATE TABLE "rescue_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"name" text NOT NULL,
	"team_type" text DEFAULT 'rescue_boat' NOT NULL,
	"contact" text,
	"zone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"registered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "case_assignments" ADD COLUMN "rescue_team_id" uuid;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "vital_status" text;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "mental_status" text;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "needs_mcat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "med_sufficient" boolean;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "oxygen_ready" boolean;--> statement-breakpoint
ALTER TABLE "rescue_teams" ADD CONSTRAINT "rescue_teams_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_rescue_team_id_rescue_teams_id_fk" FOREIGN KEY ("rescue_team_id") REFERENCES "public"."rescue_teams"("id") ON DELETE no action ON UPDATE no action;