# DATA-SPEC — หน้า "ภาพรวมผู้บัญชาการ" (overview)

> Data-backing spec ของ `docs/new/overview-commander-mockup.html`
> อิง schema จริง `src/db/schema.ts` (2026-05-31) · หลักการ: ทุก element ต้องมี column + แหล่ง input + ผู้กรอกจริง
> เป้าหมายเอกสารนี้: ก่อน build จริง รู้ว่า **เลขทุกตัวมาจาก SQL ไหน, field ไหนยังไม่มี, ใครเป็นคนกรอก, และถ้าข้อมูลไม่ครบให้ degrade ยังไง**

## 0. Decisions ที่ล็อกแล้ว (2026-05-31)

1. **Spatial = reuse ของเดิม** — ใช้ `classifyRisk()` / `haversineKm()` ใน `src/lib/geo.ts` (ใช้อยู่แล้วใน `api/vulnerable`, `api/stats`, `api/family-folder/map`, `api/field/tasks`) → ไม่สร้าง spatial ใหม่, ไม่เพิ่ม PostGIS, **ไม่แตะ `/map` เดิม**
2. **ไม่มี HIS** — ตัด consumable countdown ทั้งหมด (ไม่มี "ครบรอบ 18 ชม.") · `life_support` เป็น **flag คงที่ที่ อสม.กรอกเอง** · คะแนนใช้ระดับความเร่งด่วนคงที่ ไม่ใช่ชั่วโมงเป๊ะ

## ระดับ feasibility (ใช้ทั้งเอกสาร)

| ป้าย | ความหมาย |
| --- | --- |
| ✅ **มีแล้ว** | column มีใน schema ปัจจุบัน คำนวณได้เลย |
| 📐 **spatial** | คำนวณได้แต่ต้องทำ geo-calc (ดู §9 ข้อจำกัด GeoJSON-text) + ความสดผูกกับ cadence แหล่งข้อมูล |
| ➕ **ต้องเพิ่ม field** | ต้อง migration เพิ่มคอลัมน์ + workflow คนกรอก (ดู §10) |
| 🔌 **ต้อง integrate** | ต้องต่อ JHCIS/HIS ถึงจะได้ข้อมูลสด (เก็บมือไม่ไหว) |
| 🔁 **derive** | คำนวณจาก field อื่นที่มีแล้ว ไม่ต้องเพิ่ม column |

---

## 1. Status ribbon (6 ตัวเลข)

ทุกตัว scope ด้วย `incident_id` ของเหตุการณ์ที่กำลังจัดการ (มี `IncidentScopeProvider` แล้ว)

| ตัวเลข (mockup) | ที่มา | SQL ย่อ | feasibility |
| --- | --- | --- | --- |
| เปราะบางทั้งหมด **248** | `household_members` ที่ `type IS NOT NULL` ในพื้นที่เหตุการณ์ | `count(*) … where type is not null and deleted_at is null and (province/amphoe/tambon ∈ incident)` | ✅ |
| ในเขตน้ำท่วม **38** | บ้าน ∩ พื้นที่น้ำ | haversine `households.lat/lng` ↔ `flood_points` ใน radius / point-in-poly `flood_polygons` | 📐 |
| พึ่งอุปกรณ์พยุงชีพ **22** (O2 14/ฟอกไต 8) | ต้องรู้ว่าใครใช้ O2/ฟอกไต/ยากันชัก | `count … where life_support ?| array['oxygen','dialysis',…]` | ➕ (ดู §10.1) — v1 seed จาก `is_chronic`+`equipment`+`health_visits.oxygen_ready` |
| รอส่งต่อ รพ. **7** | คำร้อง medical/evacuation ที่ยังไม่ปิด | `help_requests where request_type in ('medical','evacuation') and status not in ('resolved','cancelled')` | ✅ |
| อพยพเข้าศูนย์ **96** | รับเข้าศูนย์ในเหตุการณ์ | `shelter_admissions where status='admitted' and incident_id=…` | ✅ |
| ทีมปฏิบัติการ **9** | ทีมในเหตุการณ์ | `rescue_teams where incident_id=… and status<>'offline'` | ✅ |

**Degrade:** ถ้า "พึ่งอุปกรณ์พยุงชีพ" ยังไม่มี field → แสดงจาก proxy (`is_chronic` + `type='bedridden'`) พร้อม tooltip "ประมาณการจากทะเบียน ยังไม่ระบุอุปกรณ์รายคน"

---

## 2. Action banner — "พึ่งอุปกรณ์พยุงชีพในเขตน้ำท่วม ยังไม่อพยพ 5 ราย"

ตัวเลข = subset ของคิว §3 ที่ตรงทั้ง 3 เงื่อนไข:

```
life_support ≠ none            (➕ ต้องเพิ่ม field)
AND in_flood_zone = true       (📐 spatial)
AND NOT EXISTS active admission (✅ shelter_admissions)
```

**Degrade:** ถ้า field อุปกรณ์ยังไม่ครบ → banner พูดความจริงระดับที่มี: "ผู้ป่วยติดเตียง/โรคเรื้อรังในเขตน้ำท่วม ยังไม่อพยพ N ราย" (จาก `type`/`is_chronic`) แทนคำว่า "อุปกรณ์พยุงชีพ"

---

## 3. 🎯 Survivability queue ("เคสร้อน") — หัวใจของหน้า

### 3.1 โมเดลคะแนน (v1 ใช้เฉพาะ input ที่เก็บได้จริง)

`score` = ผลรวมถ่วงน้ำหนักของ factor ที่ "rู้ได้จริง"; แต่ละ factor normalize 0..1

| factor | น้ำหนัก | column จริง | feasibility |
| --- | --- | --- | --- |
| พึ่งอุปกรณ์พยุงชีพ (O2 > ฟอกไต > ยากันชัก > ติดเตียง) | สูงสุด | `life_support` (➕) / fallback `type`,`is_chronic`,`health_visits.oxygen_ready`,`med_sufficient` | ➕ / 🔁 |
| ใกล้น้ำ (ยิ่งใกล้ยิ่งสูง) | สูง | `households.lat/lng` ↔ flood (haversine) | 📐 |
| ยังไม่อพยพ | gate | `NOT EXISTS shelter_admissions active` | ✅ |
| นานไม่ได้ติดต่อ | กลาง | `last_contacted_at` (หรือ `last_visited_at`) | ✅ |
| ไม่มีผู้ดูแล | กลาง | `caregiver_phone IS NULL` (proxy) | ✅ |
| มีคำร้องค้าง | กลาง | `help_requests.status` ค้าง | ✅ |

→ จัดกลุ่ม **P1/P2/P3** จาก threshold ของ score

### 3.2 3 จุดที่ mockup "โกงสายตา" + ทางลงจริง

| ใน mockup | ปัญหา input | v1 ที่ซื่อสัตย์ |
| --- | --- | --- |
| "P1 ~4ชม" (ชั่วโมงถึงอันตราย) | ไม่มี consumable countdown → คำนวณชั่วโมงเป๊ะไม่ได้ | แสดง **ระดับความเร่งด่วน** (วิกฤต/เร่งด่วน/เฝ้าระวัง) ไม่ใช่ตัวเลขชั่วโมงปลอม; ชั่วโมงจริงรอ 🔌 HIS (ตารางฟอกไต) |
| "ฟอกไต ครบรอบ 18 ชม." | ต้องรู้เวลาฟอกล่าสุด+รอบ = ข้อมูลคลินิก | v1 แสดง flag คงที่ "ฟอกไต (CAPD)"; countdown รอ 🔌 HIS |
| "ผู้ดูแลออกพื้นที่" | รู้ไม่ได้ว่าใครหายไป | เปลี่ยนเป็น "ไม่มีผู้ดูแลในทะเบียน" (`caregiver_phone IS NULL`) ✅ |
| "เสนอ เรือ ก-2 · 1.2 กม." | ทีมไม่ส่ง GPS สด | เสนอ **ทีมรับผิดชอบโซนนี้** จาก `rescue_teams.zone` ✅; ระยะโชว์เฉพาะทีมที่มี `lat/lng` |

### 3.3 Graceful degradation (สำคัญสุด)

แต่ละแถวมี **confidence** = สัดส่วน factor ที่มีข้อมูล (not null)
- ข้อมูลครบ → P1/P2/P3 + เหตุผล
- ข้อมูลไม่ครบ (เช่นไม่เคยเยี่ยม + ไม่รู้อุปกรณ์) → ป้าย **"ข้อมูลไม่ครบ · ควรเยี่ยมด่วน"** ไม่จัด P ปลอม
- กฎเหล็ก: **ห้ามแสดงความแม่นยำที่ไม่มีข้อมูลรองรับ**

---

## 4. Donut — สถานะการอพยพ (248 ราย)

| ชั้น | ที่มา | feasibility |
| --- | --- | --- |
| ยังอยู่ในเขตเสี่ยง 38 | in flood zone ∧ ไม่อพยพ | 📐 + ✅ |
| ใกล้เขตเสี่ยง 41 | ใน radius เฝ้าระวัง (เช่น 300–800 ม.) | 📐 |
| อพยพเข้าศูนย์ 96 | `shelter_admissions active` | ✅ |
| ปลอดภัย/นอกเขต 73 | ที่เหลือ (derive) | 🔁 |

---

## 5. Bars — กลุ่มเปราะบาง (total + ในเขตน้ำ)

`group by household_members.type` (+ `is_chronic`, `is_disabled`) → total ✅; ส่วน "ในเขตน้ำ" = total ∩ flood 📐
**Degrade:** ถ้า spatial ยังไม่พร้อม → ซ่อนแถบแดง แสดงเฉพาะ total

---

## 6. ศูนย์พักพิงใกล้เต็ม + health-readiness ✅ (backed เต็ม)

| ใน mockup | column | 
| --- | --- |
| 264/280 (94%) | `infrastructures.occupancy / capacity` |
| แถบสีร้อน/เตือน | `readiness_status` หรือ occupancy% |
| "เตียงพยาบาล 6/8" | `bedridden_capacity` (8) + count admissions ใน zone ติดเตียง (6) |
| "มีออกซิเจน" / "ไม่มีออกซิเจน" | `oxygen_support` (boolean) |
| ผู้ดูแล | `shelter_staff` → `users.name` |

จุดนี้ **ไม่ต้องเพิ่มอะไร** — schema รองรับครบ (รวม `health_capacity`, `wheelchair_support`, `electricity_support`)

---

## 7. การ์ดครัวเรือน (กางจากแถว)

| ส่วน | column | feasibility |
| --- | --- | --- |
| สมาชิกทุกคน + อายุ/เบอร์ | `household_members` by `household_id` (`first_name`,`age`,`phone`,`family_position`,`is_head`) | ✅ |
| ผู้ดูแล | `caregiver_phone` + สมาชิกที่ `family_position`/`is_head` | ✅ |
| **รายการต้องนำติดตัว (bring-list)** | 🔁 derive จาก `life_support`: O2→"ถัง O2", dialysis→"น้ำยาฟอกไต", + เสมอ "บัตรประชาชน/บัตรทอง" | 🔁 (พึ่ง §10.1) |
| ผู้รับผิดชอบ (อสม.) | `assigned_vhv_id` → users | ✅ |

**bring-list ไม่ต้องเพิ่ม column** ถ้ามี `life_support` แล้ว → derive ได้ (เพิ่ม free-text เสริมภายหลังถ้าต้องการ)

---

## 8. โหมดปกติ — coverage หมู่บ้านค้างเยี่ยม ✅

| ใน mockup | column |
| --- | --- |
| "ค้าง 142 วัน" | `now() - max(last_visited_at)` group by `villcode`/หมู่บ้าน |
| "เปราะบาง 8 / ติดเตียง 2" | count by `type` ในหมู่บ้าน |
| "เคยน้ำท่วม 2566" | ➕/📐 ต้องมี flag ประวัติน้ำท่วมต่อหมู่บ้าน (derive จาก `flood_polygons` ย้อนหลัง หรือ field) |
| "มอบหมาย อสม." | เขียน `assigned_vhv_id` |

---

## 9. ⚠️ ข้อจำกัด spatial (cross-cutting — ต้องตัดสินใจก่อน build)

`flood_polygons.geojson` เก็บเป็น **text (GeoJSON string)** ไม่ใช่ PostGIS geometry และ DB ไม่มี PostGIS → ทำ `ST_Distance/ST_Intersects` ตรงๆ ไม่ได้

**ตัดสินแล้ว → ใช้ของเดิม:** `src/lib/geo.ts` มี `classifyRisk()` (flood <0.5 กม. / near / safe) + `haversineKm()` อยู่แล้ว และถูก reuse ใน 6 จุด → หน้าภาพรวมเรียกใช้ซ้ำได้เลย (point-based กับ `flood_points`/`user_flood_marks`). PostGIS + polygon coverage เก็บเป็นงานอนาคต ไม่ทำตอนนี้

**ความสด:** flood_points = ดาวเทียมรายวัน, user_flood_marks = อสม.ปักรายครั้ง, water_station = รายชั่วโมง → "ใกล้น้ำ" สดสุดระดับ **ชั่วโมง/วัน ไม่ใช่นาที** — UI/banner ต้องไม่โฆษณาเกินจริง

---

## 10. Schema delta ที่ต้องเพิ่มจริง (น้อยกว่าที่คิด)

### 10.1 `household_members.life_support` ➕ (อันเดียวที่จำเป็น)
```sql
ALTER TABLE household_members
  ADD COLUMN life_support jsonb;     -- เช่น ["oxygen","dialysis_capd","anti_seizure"]
-- ค่า: oxygen | dialysis_capd | dialysis_hd | ventilator | anti_seizure | feeding_tube | none
-- (ข้าม) life_support_detail/consumable countdown — ต้องมี HIS ก่อน ซึ่งตอนนี้ไม่มีแผนเชื่อม
```
- **ใครกรอก:** อสม. ตอนเยี่ยม (เพิ่ม checkbox ในฟอร์ม `health_visits`/intake) — กรอกมือล้วน (ไม่มี HIS); JHCIS sync เสริมได้ภายหลัง
- **seed v1:** backfill จาก `equipment` (freeform), `is_chronic`, `type='bedridden'`, `health_visits.oxygen_ready=true`
- ปลดล็อก: ribbon "พึ่งอุปกรณ์ 22", banner, factor คะแนน, bring-list — ทั้งหมดจาก field เดียวนี้

### 10.2 Closed-loop referral — แทบไม่ต้องเพิ่ม ✅
`case_assignments.status` **มี `'arrived'` แล้ว** → "ส่งแล้วไม่ถึง" = `status in ('assigned','accepted','en_route')` ที่ `assigned_at` เกิน threshold
- (เสริมเล็กถ้าต้องการ confirm ชัด) `ADD COLUMN arrived_confirmed_by uuid, arrived_at timestamptz`
- **ใครกรอก:** ทีม/ปลายทาง (รพ./ศูนย์) กดยืนยันรับ

### 10.3 ประวัติน้ำท่วมรายหมู่บ้าน (สำหรับโหมดปกติ) — derive ก่อน
v1 derive จาก `flood_polygons` ย้อนหลัง (มี tambon/amphoe) ทับหมู่บ้าน; ถ้าช้าค่อยทำ flag cache

---

## 11. แหล่ง input ต่อ role (ตอบ "ใครเป็นคนกรอก")

| ข้อมูล | ผู้กรอก/แหล่ง | ช่องทาง |
| --- | --- | --- |
| ทะเบียนคน + อุปกรณ์พยุงชีพ + ผู้ดูแล | **อสม.** | intake / ฟอร์มเยี่ยม (`health_visits`) · sync 🔌 JHCIS |
| เยี่ยม/ติดต่อ → `last_contacted_at`,`last_visited_at` | **อสม.** | ปุ่ม "บันทึกเยี่ยม/ติดต่อ" (mobile, offline-first) |
| คำร้องขอช่วย → triage | **อสม./EOC** | `help_requests` + `case_assignments` |
| รับเข้า/ย้ายออกศูนย์ + เตียงพยาบาล/O2 | **จนท.ศูนย์** | shelters intake (มีแล้ว) |
| ทีม + โซน + (GPS ถ้ามี) | **admin/EOC** | rescue-teams (มีแล้ว) |
| น้ำ (จุด/หมุด/ระดับ) | ดาวเทียม + **อสม.ปักหมุด** + telemetry | ingest / `user_flood_marks` |
| ตารางฟอกไต/ยา (countdown สด) | **ตัดออก** — ไม่มีแผนเชื่อม HIS | v1 ใช้ flag คงที่แทน (อสม.กรอก) |

---

## 12. สรุปสำหรับ build

1. **หน้านี้ ~70% query ได้เลยจาก schema ปัจจุบัน** (ribbon ส่วนใหญ่, donut บางส่วน, ศูนย์, การ์ดครัวเรือน, coverage)
2. **เพิ่มจริงแค่ 1 field สำคัญ:** `household_members.life_support` (+ seed) → ปลดล็อกอุปกรณ์พยุงชีพ/banner/คะแนน/bring-list
3. **spatial = reuse `src/lib/geo.ts`** (`classifyRisk`/`haversineKm`) — ตัดสินแล้ว ไม่แตะ `/map` เดิม
4. **closed-loop referral มีโครงแล้ว** (`case_assignments.status='arrived'`)
5. **คะแนน survivability = เฉพาะ input จริง + confidence + degrade** ห้ามโชว์ชั่วโมงปลอม; "live" = ตาม cadence จริง
6. ทุก field ใหม่ผูกกับ workflow คนกรอกจริงเสมอ (§11) ไม่งั้นว่างเปล่าใน production
