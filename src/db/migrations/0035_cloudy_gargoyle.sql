ALTER TABLE "users" ADD COLUMN "sso_subject" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sso_subject_unique" UNIQUE("sso_subject");--> statement-breakpoint
-- cleanup: ลบ test SSO records เก่าที่เคยเก็บ cid_hash ปลอม (hash ของ 'sso:'+provider_id)
-- ก่อนเปลี่ยนมาใช้ sso_subject — record เหล่านี้ status=pending ไม่มีข้อมูลจริง
DELETE FROM "users" WHERE "registered_via" = 'sso' AND "status" = 'pending' AND "sso_subject" IS NULL;