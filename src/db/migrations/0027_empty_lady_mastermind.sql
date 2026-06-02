ALTER TABLE "access_log" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "user_agent" text;--> statement-breakpoint
CREATE INDEX "idx_access_log_user" ON "access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_entity_target" ON "access_log" USING btree ("entity","target_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_at" ON "access_log" USING btree ("at");