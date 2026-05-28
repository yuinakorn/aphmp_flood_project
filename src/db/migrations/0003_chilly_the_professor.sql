CREATE TABLE "user_flood_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lat" numeric(10, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"water_level_cm" numeric(6, 1) NOT NULL,
	"level" smallint NOT NULL,
	"place_detail" text,
	"place_around" text,
	"province" text,
	"amphoe" text,
	"tambon" text,
	"contact_phone" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"image_url" text,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_flood_marks" ADD CONSTRAINT "user_flood_marks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;