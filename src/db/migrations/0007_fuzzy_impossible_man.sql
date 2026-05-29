ALTER TABLE "household_members" ADD COLUMN "prefix" text;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "first_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "household_members" ADD COLUMN "last_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "prefix" text;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "first_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "vulnerable_persons" ADD COLUMN "last_name" text NOT NULL;