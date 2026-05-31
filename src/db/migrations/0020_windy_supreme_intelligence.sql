CREATE TABLE "sit_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"report_date" date NOT NULL,
	"report_time" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"manual" jsonb,
	"measures" text,
	"plan_note" text,
	"auto_snapshot" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sit_reports" ADD CONSTRAINT "sit_reports_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sit_reports_incident_id" ON "sit_reports" USING btree ("incident_id");