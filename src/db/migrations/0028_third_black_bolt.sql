CREATE TABLE "flood_risk_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province" text NOT NULL,
	"name" text NOT NULL,
	"priority" smallint DEFAULT 1 NOT NULL,
	"polygon" jsonb NOT NULL,
	"notes" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_flood_risk_zones_province" ON "flood_risk_zones" USING btree ("province");