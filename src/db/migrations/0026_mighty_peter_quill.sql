CREATE TABLE "hospital_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"admission_id" uuid,
	"member_id" uuid,
	"from_shelter_id" uuid NOT NULL,
	"to_facility_id" uuid,
	"to_facility_text" text,
	"person_name" text,
	"reason" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"referred_by" uuid,
	"referred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "hospital_referrals" ADD CONSTRAINT "hospital_referrals_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_referrals" ADD CONSTRAINT "hospital_referrals_admission_id_shelter_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."shelter_admissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_referrals" ADD CONSTRAINT "hospital_referrals_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_referrals" ADD CONSTRAINT "hospital_referrals_from_shelter_id_infrastructures_id_fk" FOREIGN KEY ("from_shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_referrals" ADD CONSTRAINT "hospital_referrals_to_facility_id_infrastructures_id_fk" FOREIGN KEY ("to_facility_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_hospital_referrals_to_facility" ON "hospital_referrals" USING btree ("to_facility_id");--> statement-breakpoint
CREATE INDEX "idx_hospital_referrals_incident" ON "hospital_referrals" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_hospital_referrals_status" ON "hospital_referrals" USING btree ("status");