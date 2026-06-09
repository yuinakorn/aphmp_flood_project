CREATE TABLE "hazard_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"category" text DEFAULT 'temporary' NOT NULL,
	"color" text DEFAULT 'oklch(0.62 0.02 260)' NOT NULL,
	"emoji" text DEFAULT '⚠️' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hazard_types_code_key" ON "hazard_types" USING btree ("code");--> statement-breakpoint
-- seed ชนิดภัยหลักของระบบ (ตรงกับโซนเดิม; isSystem = ลบไม่ได้/code คงที่)
INSERT INTO "hazard_types" ("code","label","category","color","emoji","sort_order","is_active","is_system") VALUES
  ('flood','น้ำท่วม','permanent','oklch(0.60 0.18 240)','🌊',10,true,true),
  ('earthquake','แผ่นดินไหว','temporary','oklch(0.58 0.16 50)','🌐',20,true,true),
  ('epidemic','โรคระบาด','temporary','oklch(0.55 0.20 330)','🦠',30,true,true),
  ('other','อื่น ๆ','temporary','oklch(0.62 0.02 260)','⚠️',90,true,true)
ON CONFLICT ("code") DO NOTHING;