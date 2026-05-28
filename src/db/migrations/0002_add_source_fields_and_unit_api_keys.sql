CREATE TABLE "unit_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"unit_code" text NOT NULL,
	"unit_name" text NOT NULL,
	"province" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone,
	CONSTRAINT "unit_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "source_system" text;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "source_unit" text;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "source_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "vp_source_unique_idx" ON "vulnerable_persons" USING btree ("source_system","source_unit","source_id");