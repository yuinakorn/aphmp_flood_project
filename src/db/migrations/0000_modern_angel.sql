CREATE TABLE "access_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target_id" uuid,
	"ip" "inet",
	"at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"help_request_id" uuid NOT NULL,
	"assigned_to" uuid,
	"assigned_team" text,
	"assigned_by" uuid,
	"status" text DEFAULT 'assigned' NOT NULL,
	"eta_minutes" integer,
	"notes" text,
	"assigned_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flood_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lat" numeric(10, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"intensity" smallint DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'sentinel-1' NOT NULL,
	"observed_at" date NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flood_polygons" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"geojson" text NOT NULL,
	"tambon" text,
	"amphoe" text,
	"province" text,
	"source" text DEFAULT 'sentinel-2' NOT NULL,
	"observed_at" date NOT NULL,
	"area_sqkm" numeric(10, 3),
	"ingested_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerable_person_id" uuid,
	"visited_by" uuid,
	"visit_status" text DEFAULT 'pending' NOT NULL,
	"person_status" text,
	"needs_help" boolean DEFAULT false NOT NULL,
	"help_type" text,
	"notes" text,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerable_person_id" uuid,
	"requested_by" uuid,
	"source_role" text DEFAULT 'vhv' NOT NULL,
	"request_type" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"description" text,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"preferred_shelter_id" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "infrastructures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"capacity" integer,
	"occupancy" integer DEFAULT 0 NOT NULL,
	"readiness_status" text DEFAULT 'open' NOT NULL,
	"health_capacity" integer,
	"bedridden_capacity" integer,
	"wheelchair_support" boolean DEFAULT false NOT NULL,
	"oxygen_support" boolean DEFAULT false NOT NULL,
	"electricity_support" boolean DEFAULT false NOT NULL,
	"water_sanitation_status" text,
	"health_resources" jsonb,
	"lat" numeric(10, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"icon" text,
	"contact" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shelter_admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelter_id" uuid NOT NULL,
	"vulnerable_person_id" uuid,
	"help_request_id" uuid,
	"admitted_by" uuid,
	"status" text DEFAULT 'admitted' NOT NULL,
	"needs_follow_up" boolean DEFAULT false NOT NULL,
	"notes" text,
	"admitted_at" timestamp with time zone DEFAULT now(),
	"discharged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shelter_status_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"shelter_id" uuid NOT NULL,
	"occupancy" integer NOT NULL,
	"capacity" integer,
	"readiness_status" text NOT NULL,
	"health_resources" jsonb,
	"reported_by" uuid,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vulnerable_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"age" smallint,
	"cond" text,
	"equipment" text,
	"village" text,
	"tambon" text,
	"amphoe" text,
	"lat" numeric(10, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"caregiver_phone" text,
	"care_unit" text,
	"assigned_vhv_id" uuid,
	"medical_priority" text DEFAULT 'C' NOT NULL,
	"follow_up_status" text DEFAULT 'pending' NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"last_visited_at" timestamp with time zone,
	"last_known_status" text,
	"consent" boolean DEFAULT false,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_help_request_id_help_requests_id_fk" FOREIGN KEY ("help_request_id") REFERENCES "public"."help_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_vulnerable_person_id_vulnerable_persons_id_fk" FOREIGN KEY ("vulnerable_person_id") REFERENCES "public"."vulnerable_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_visits" ADD CONSTRAINT "health_visits_visited_by_users_id_fk" FOREIGN KEY ("visited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_vulnerable_person_id_vulnerable_persons_id_fk" FOREIGN KEY ("vulnerable_person_id") REFERENCES "public"."vulnerable_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_preferred_shelter_id_infrastructures_id_fk" FOREIGN KEY ("preferred_shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_shelter_id_infrastructures_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_vulnerable_person_id_vulnerable_persons_id_fk" FOREIGN KEY ("vulnerable_person_id") REFERENCES "public"."vulnerable_persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_help_request_id_help_requests_id_fk" FOREIGN KEY ("help_request_id") REFERENCES "public"."help_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_admissions" ADD CONSTRAINT "shelter_admissions_admitted_by_users_id_fk" FOREIGN KEY ("admitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_status_snapshots" ADD CONSTRAINT "shelter_status_snapshots_shelter_id_infrastructures_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_status_snapshots" ADD CONSTRAINT "shelter_status_snapshots_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD CONSTRAINT "vulnerable_persons_assigned_vhv_id_users_id_fk" FOREIGN KEY ("assigned_vhv_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD CONSTRAINT "vulnerable_persons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;