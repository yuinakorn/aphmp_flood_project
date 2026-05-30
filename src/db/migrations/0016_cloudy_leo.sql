CREATE TABLE "shelter_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "national_id" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "hno" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "villno" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "food_allergy" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "drug_allergy" text;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "intake_point" text;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "brought_by_team_id" uuid;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "brought_by_text" text;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "exit_reason" text;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "exit_destination" text;--> statement-breakpoint
ALTER TABLE "shelter_zones" ADD CONSTRAINT "shelter_zones_shelter_id_infrastructures_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_zone_id_shelter_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shelter_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_brought_by_team_id_rescue_teams_id_fk" FOREIGN KEY ("brought_by_team_id") REFERENCES "public"."rescue_teams"("id") ON DELETE no action ON UPDATE no action;