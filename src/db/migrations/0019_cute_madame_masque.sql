CREATE TABLE "disease_surveillance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"disease_code" text NOT NULL,
	"disease_label" text,
	"case_count" integer DEFAULT 0 NOT NULL,
	"report_date" date NOT NULL,
	"tambon" text,
	"amphoe" text,
	"shelter_id" uuid,
	"notes" text,
	"reported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_casualties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"member_id" uuid,
	"casualty_type" text NOT NULL,
	"severity" text,
	"person_name" text,
	"age" smallint,
	"sex" text,
	"cause" text,
	"tambon" text,
	"amphoe" text,
	"notes" text,
	"reported_by" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "disease_surveillance" ADD CONSTRAINT "disease_surveillance_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disease_surveillance" ADD CONSTRAINT "disease_surveillance_shelter_id_infrastructures_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_casualties" ADD CONSTRAINT "incident_casualties_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_casualties" ADD CONSTRAINT "incident_casualties_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_disease_surveillance_incident_id" ON "disease_surveillance" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_incident_casualties_incident_id" ON "incident_casualties" USING btree ("incident_id");