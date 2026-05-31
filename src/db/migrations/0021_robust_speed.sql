CREATE TABLE "shelter_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"shelter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "shelter_staff" ADD CONSTRAINT "shelter_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelter_staff" ADD CONSTRAINT "shelter_staff_shelter_id_infrastructures_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."infrastructures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shelter_staff_user_shelter_idx" ON "shelter_staff" USING btree ("user_id","shelter_id");--> statement-breakpoint
CREATE INDEX "idx_shelter_staff_user_id" ON "shelter_staff" USING btree ("user_id");