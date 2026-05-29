CREATE TABLE "user_flood_mark_code_seq" (
	"prefix" text PRIMARY KEY NOT NULL,
	"last_no" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_flood_marks" ADD COLUMN "code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_flood_marks_code_key" ON "user_flood_marks" USING btree ("code");