# Phase 3: Data Ownership + Platform Foundation — สถานะ

อัปเดตล่าสุด: 2026-05-29

ระบบถูกยกระดับจาก "FloodWatch" เป็นแพลตฟอร์ม **GIS Health Intelligence** โดยมีโมดูลเฝ้าระวังน้ำท่วม (Flood Map) เป็นโมดูลแรก และพร้อมขยายสู่ภารกิจสุขภาพอื่นในอนาคต Phase นี้เน้น **ย้ายความเป็นเจ้าของข้อมูลมาที่ DB ของระบบเอง และตัดการพึ่งพา JHCIS โดยสมบูรณ์**

---

## สิ่งที่ทำเสร็จแล้วใน phase นี้

### 1. ตัด JHCIS ออกโดยสมบูรณ์

- ลบ `src/lib/jhcis-db.ts` (connection pool) — ไม่มี import เหลือในโค้ดแล้ว
- `cmu-flood-alert` (ตัวนับ "ผู้ป่วยในพื้นที่ท่วม" บน StatusStrip/banner) เปลี่ยนมานับจาก `vulnerable_persons` แทน query JHCIS สด → แก้ปัญหา `ETIMEDOUT`
- Family Folder เปลี่ยนมาอ่านจากตารางของระบบเอง (รายละเอียดข้อ 2)
- เก็บกวาด labels ในหน้า admin ที่เขียน "จาก JHCIS / real-time" ออก

**ค้าง:** dependency `mysql2` + env `JHCIS_DB_*` ไม่ถูกใช้แล้ว ยังไม่ได้ถอด (ไม่เร่ง)

### 2. ทะเบียนกลุ่มเปราะบาง + Family Folder เป็นของระบบเอง

ตารางใหม่ (migration `0006`):

| ตาราง | หน้าที่ |
|---|---|
| `households` | ครัวเรือน — hno, หมู่บ้าน/villcode, ตำบล/อำเภอ/จังหวัด, พิกัด |
| `household_members` | สมาชิกครัวเรือนทุกคน + ความสัมพันธ์ (father/mother/mate), isHead, พิการ/เรื้อรัง |

- `vulnerable_persons` เพิ่มคอลัมน์ `household_id` เชื่อมทะเบียน (แผนที่) ↔ family folder
- `src/lib/family-folder.ts` เขียนใหม่ อ่านจาก DB เราเอง คืน type เดิม (`VillageSummary` / `VulnerableHousehold` / `HouseholdMember`) → routes + UI ไม่ต้องแก้
- family folder แสดงเฉพาะครัวเรือนที่มีกลุ่มเปราะบาง, สรุปรายหมู่บ้าน (ผู้สูงอายุ/เด็ก/พิการ/เรื้อรัง) คำนวณ group จาก age + flag

### 3. แยกชื่อเป็น คำนำหน้า / ชื่อ / นามสกุล

- `household_members` และ `vulnerable_persons`: เปลี่ยน `name` (ฟิลด์เดียว) → `prefix` (nullable) + `first_name` + `last_name` (notNull) — migration `0007` (เพิ่ม) + `0008` (drop name)
- เพิ่ม helper `composeName(prefix, first, last)` ใน `field-api.ts`
- **API ยังคืน field `name` (ประกอบจาก parts)** เพื่อไม่ให้ frontend พัง และเพิ่ม prefix/firstName/lastName ในผลลัพธ์
- อัปเดตทุก reader/writer: `api/vulnerable` GET/POST, `api/vulnerable/[id]`, `api/ingest/vulnerable` (รับ parts), `api/field/tasks`, `family-folder.ts`, `seed.ts`

### 4. Mock data 3 จังหวัด (เชียงใหม่ / เชียงราย / น่าน)

- Seed: `npm run db:seed:vulnerable` ([seed-vulnerable-mock.ts](../src/db/seed-vulnerable-mock.ts)) — idempotent (ล้าง `sourceSystem='import'` + household tables ก่อน)
- ล่าสุด: ~41 ครัวเรือน · ~161 สมาชิก · ~84 คนในทะเบียนกลุ่มเปราะบาง
- ใช้ อำเภอ/ตำบล/หมู่บ้านจริง, ชื่อไทย, พิกัดกระจายในจังหวัด, ความสัมพันธ์ครัวเรือน (หัวหน้า/คู่สมรส/บุตร/ผู้สูงอายุ) สอดคล้องกันระหว่างแผนที่ ↔ family folder ผ่าน `household_id`

### 5. ที่อยู่มาตรฐาน (DOPA) — cascading dropdown

- ตาราง `geo_provinces` / `geo_districts` / `geo_subdistricts` (migration `0005`) จากข้อมูลกรมการปกครอง (kongvut/thai-province-data) — 77 จังหวัด / 930 อำเภอ / 7,452 ตำบล + รหัสไปรษณีย์
- Seed: `npm run db:seed:geo`
- API: `/api/geo/provinces` (จำกัด 8 จังหวัดภาคเหนือตามขอบเขตโปรเจกต์), `/districts?provinceId=`, `/subdistricts?districtId=`
- Component `AddressSelect` (cascading จังหวัด→อำเภอ→ตำบล) ใช้ในฟอร์มปักหมุด flood mark

### 6. โมดูล Flood Map — ฟีเจอร์เสริม

- **ผู้ใช้ปักหมุด flood mark เอง** (officer/vhv+): ตาราง `user_flood_marks` (migration `0003`/`0004`), API `POST/GET /api/user-flood-marks` + `PATCH/DELETE /[id]`, ฟอร์ม `UserFloodMarkForm`, layer + ปุ่มปักหมุดในแผนที่
- **Alert banner วนลูปทุกจังหวัด** — ขับด้วย `/api/water-level/summary` (ไม่ใช่เฉพาะเชียงใหม่), card-swap animation, alert ต่อจังหวัดจากค่าที่รุนแรงกว่าระหว่างต้นน้ำ/ปลายน้ำ
- **แก้ bug water-level**: classifier (`classifyAlert` / `classifyAlertMaesai`) มองข้าม threshold ที่ `<= 0` (ยังไม่กำหนด) — เดิมสถานีที่ไม่มี threshold ถูกตีเป็น "อันตรายสูง" เสมอ
- ใส่ threshold จริงสถานีแม่สาย Kh.89 (เฝ้าระวัง 3.40 / ล้นตลิ่ง 4.40 ม.) ผ่าน `npm run db:seed:maesai`; Kh.72 ต้นน้ำใช้ rise-speed (ไม่มีเกณฑ์สัมบูรณ์ทางการ)

### 7. Responsive (mobile) + รีแบรนด์

- สลับ shell ที่ breakpoint `md` (768px): Rail → bottom nav, panel → bottom sheet, StatusStrip scroll แนวนอน, Masthead/MapOverlay ปรับ touch
- รีแบรนด์ทั้งระบบเป็น **GIS Health Intelligence** (Masthead, login, title, description) — เมนู "แผนที่" → "Flood Map" พร้อมไอคอน Waves, โลโก้แบรนด์ใช้ไอคอน `MapPinned`

---

## โครงสร้างฐานข้อมูล (migration ปัจจุบันถึง 0008)

| Migration | เนื้อหา |
|---|---|
| `0002` | source fields ใน vulnerable_persons + `unit_api_keys` |
| `0003` / `0004` | `user_flood_marks` + ถอด FK created_by |
| `0005` | `geo_provinces` / `geo_districts` / `geo_subdistricts` |
| `0006` | `households` / `household_members` + `household_id` ใน vulnerable_persons |
| `0007` / `0008` | แยก prefix/first_name/last_name (เพิ่ม → drop name) |

Seed scripts: `db:seed` (demo flood/infra), `db:seed:geo`, `db:seed:maesai`, `db:seed:vulnerable`

---

## สิ่งที่ยังค้าง / ทำต่อ

- [ ] ถอด dependency `mysql2` + env `JHCIS_DB_*` ที่ไม่ใช้แล้ว
- [ ] ฟอร์มจัดการทะเบียนกลุ่มเปราะบางใน admin (CRUD เต็ม) — ตอนนี้หน้า /admin/vulnerable เป็น read-only
- [ ] เก็บ `birth_date` แทน `age` (คำนวณอายุ ณ ปัจจุบัน แม่นกว่า)
- [ ] per-province patient counts (PIP เฉพาะเชียงใหม่อยู่ — ขยายให้ครบจังหวัด)
- [ ] ทดสอบ UI จริงบนมือถือ (โค้ด/build ผ่านแล้ว แต่ยังไม่ได้ verify visual)

## Phase ถัดไป (ค้างจาก Phase 2)

- EOC Triage Queue — หน้า `/admin/triage` คิว help requests เรียง priority/status + assignment timeline (logic auto-escalate มีแล้วใน POST help-requests)
