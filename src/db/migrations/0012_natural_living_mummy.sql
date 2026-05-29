ALTER TABLE IF EXISTS "vulnerable_persons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "vulnerable_persons" CASCADE;--> statement-breakpoint
ALTER TABLE "health_visits" DROP CONSTRAINT IF EXISTS "health_visits_vulnerable_person_id_vulnerable_persons_id_fk";
--> statement-breakpoint
ALTER TABLE "help_requests" DROP CONSTRAINT IF EXISTS "help_requests_vulnerable_person_id_vulnerable_persons_id_fk";
--> statement-breakpoint
ALTER TABLE "shelter_admissions" DROP CONSTRAINT IF EXISTS "shelter_admissions_vulnerable_person_id_vulnerable_persons_id_fk";
--> statement-breakpoint
ALTER TABLE "household_members" ALTER COLUMN "household_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "health_visits" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "help_requests" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "cond" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "equipment" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "village" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "tambon" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "amphoe" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "lat" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "lng" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "caregiver_phone" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "care_unit" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "assigned_vhv_id" uuid;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "medical_priority" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "follow_up_status" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "last_visited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "last_known_status" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "consent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "source_system" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "source_unit" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "source_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD COLUMN "member_id" uuid;--> statement-breakpoint
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_assigned_vhv_id_users_id_fk" FOREIGN KEY ("assigned_vhv_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hm_source_unique_idx" ON "household_members" USING btree ("source_system","source_unit","source_id");--> statement-breakpoint
ALTER TABLE "health_visits" DROP COLUMN "vulnerable_person_id";--> statement-breakpoint
ALTER TABLE "help_requests" DROP COLUMN "vulnerable_person_id";--> statement-breakpoint
ALTER TABLE "shelter_admissions" DROP COLUMN "vulnerable_person_id";