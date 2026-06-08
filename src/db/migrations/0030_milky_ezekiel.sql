CREATE TABLE "public_help_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_name" text,
	"reporter_phone" text NOT NULL,
	"request_type" text NOT NULL,
	"description" text,
	"people_count" integer,
	"province" text,
	"address_text" text,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"help_request_id" uuid,
	"incident_id" uuid,
	"user_agent" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "public_help_reports" ADD CONSTRAINT "public_help_reports_help_request_id_help_requests_id_fk" FOREIGN KEY ("help_request_id") REFERENCES "public"."help_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_help_reports" ADD CONSTRAINT "public_help_reports_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_public_help_reports_status" ON "public_help_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_public_help_reports_province" ON "public_help_reports" USING btree ("province");