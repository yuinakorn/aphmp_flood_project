ALTER TABLE "flood_risk_zones" ADD COLUMN "category" text DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "flood_risk_zones" ADD COLUMN "hazard_type" text DEFAULT 'flood' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_flood_risk_zones_category" ON "flood_risk_zones" USING btree ("province","category","hazard_type");