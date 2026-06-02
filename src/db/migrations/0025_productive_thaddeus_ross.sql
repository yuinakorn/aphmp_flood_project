CREATE TABLE "incident_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"province" text,
	"amphoe" text,
	"tambon" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "incident_areas" ADD CONSTRAINT "incident_areas_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_areas_incident_idx" ON "incident_areas" ("incident_id");--> statement-breakpoint
-- backfill: 1 พื้นที่/incident จากคอลัมน์หลักเดิม
INSERT INTO "incident_areas" ("incident_id", "province", "amphoe", "tambon")
SELECT "id", "province", "amphoe", "tambon" FROM "incidents" i
WHERE NOT EXISTS (SELECT 1 FROM "incident_areas" a WHERE a."incident_id" = i."id");