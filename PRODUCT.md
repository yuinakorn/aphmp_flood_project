# PRODUCT.md — ระบบภูมิสารสนเทศสุขภาพชุมชน & ศูนย์ตอบโต้ภัยพิบัติ

> **Spatial Health Registry & Disaster Response Platform**
> เอกสารนี้เป็น single source of truth สำหรับทำความเข้าใจระบบทั้งหมด — สำหรับนักพัฒนาใหม่, AI agent, หรือผู้ที่ต้องประเมิน/รับช่วงต่อโครงการ
> อ่านจบแล้วต้องเข้าใจ: ระบบนี้ทำอะไร, เพื่อใคร, ประกอบด้วยอะไร, ข้อมูลไหลอย่างไร, และมีข้อจำกัด/ขอบเขตแค่ไหน
> เอกสารประกอบ: `DESIGN.md` (ระบบดีไซน์/UI), `docs/health-first-system-context.md` (บริบทเชิงนโยบาย), `src/db/schema.ts` (โครงสร้างข้อมูลจริง)

---

## 1. ภาพรวมหนึ่งย่อหน้า

ระบบนี้คือ **ทะเบียนสุขภาพชุมชนเชิงพื้นที่ (spatial health registry)** ที่เจ้าหน้าที่สาธารณสุขหน้าด่าน (อสม. / รพ.สต. / โรงพยาบาล) ใช้ดูแล **กลุ่มเปราะบาง** (ผู้ป่วยติดเตียง สูงอายุ พิการ ตั้งครรภ์ ผู้พึ่งอุปกรณ์พยุงชีพ) ได้ตลอดทั้งปี และสามารถ **ยกระดับเป็นศูนย์บัญชาการเหตุการณ์ (EOC)** ได้ทันทีเมื่อเกิดภัยพิบัติ — โดยเฉพาะน้ำท่วม — บนหน้าจอเดียวกันและฐานข้อมูลชุดเดียวกัน หัวใจของระบบคือหลักการ **"หมุด = บ้าน"**: ทุกครัวเรือนเป็นหมุดบนแผนที่ที่รู้ว่าใครอยู่ในบ้าน เบอร์ใครบ้าง ใครเปราะบางระดับไหน และต้องนำอุปกรณ์พยุงชีพอะไรติดตัวเมื่ออพยพ

**คุณค่าหลัก:** ข้อมูลที่ถูกดูแลให้สดอยู่เสมอในงานประจำวัน จะ "พร้อมใช้ทันที" ในวันวิกฤต — ไม่ต้องเริ่มกรอกข้อมูลตอนน้ำมาแล้ว

---

## 2. ปัญหาที่แก้ & เป้าหมาย

### ปัญหา
- ข้อมูลกลุ่มเปราะบางกระจัดกระจาย/ล้าสมัย/อยู่บนกระดาษ → ตอนวิกฤตหาไม่เจอหรือไม่ทันสมัย
- ไม่รู้ว่าใครต้องพาเครื่องช่วยหายใจ / น้ำยาล้างไต / ยาต้านชัก ไปด้วยตอนอพยพ
- ทีมกู้ภัยเข้าช่วยซ้ำซ้อนบางจุด ขณะที่บางบ้านถูกลืม (บทเรียนภาคสนามจริง)
- คำร้องขอความช่วยเหลือไม่มีการคัดกรองความเร่งด่วน (triage)
- ศูนย์บัญชาการขาดภาพรวมเดียวที่ตอบ "น้ำอยู่ไหน + ใครเสี่ยง + ทีมไหนทำอะไรแล้ว"

### เป้าหมาย
1. ลดการสูญเสียในกลุ่มเปราะบางช่วงภัยพิบัติด้วยข้อมูลที่พร้อมและแม่นยำ
2. ทำให้การสั่งการอยู่บนข้อมูลจริงรายพื้นที่/รายบ้าน ไม่ใช่การคาดเดา
3. ใช้ข้อมูลชุดเดียวทั้งงานปกติ (เยี่ยมบ้าน/คัดกรอง) และงานวิกฤต (อพยพ/ช่วยเหลือ)
4. ขยายผลใช้ได้ทุกจังหวัดโดยไม่ต้องแก้โค้ด (multi-province, configurable)

---

## 3. แนวคิดแกนกลาง: สองโหมดบนระบบเดียว

ระบบมี state กลางหนึ่งตัว สลับได้ที่ **Incident Switcher** มุมขวาบนของ header

| | **โหมดปกติ (Normal / ดูแลสุขภาพ)** | **โหมดวิกฤต (Crisis / ภัยพิบัติ)** |
| --- | --- | --- |
| ใช้เมื่อ | ~360 วัน/ปี | เมื่อผู้ใช้ "เลือกเหตุการณ์ (incident)" เอง — ไม่ auto-pick |
| โฟกัส | coverage การเยี่ยมรายหมู่บ้าน, ความครบถ้วนข้อมูล | คิวคำร้อง, อพยพ, นับ flood/near/safe, สถานการณ์ |
| โทน UI | สงบ | เร่งด่วน + banner ค้างตลอด session |
| การผูกข้อมูล | ทะเบียนกลาง | ทุก entity ใหม่ (visit/request/admission/team) ผูกกับ incident อัตโนมัติ; ตัวเลขทุกหน้า filter เฉพาะ incident นั้น |

**Incident Scope (หัวใจของโหมดวิกฤต)**
- ทำงาน **ทีละ 1 เหตุการณ์** เท่านั้น → บังคับ focus ไม่ปนข้ามเหตุการณ์
- 1 เหตุการณ์ครอบคลุมได้ **หลายอำเภอ/ตำบล** ผ่านตาราง `incident_areas` (1 incident → N areas, hierarchical: tambon=null = ทั้งอำเภอ, amphoe=null = ทั้งจังหวัด) และขยายพื้นที่ได้เมื่อสถานการณ์ลาม
- **สิทธิ์เห็น incident:** operator (vhv/officer/ems) เห็นเฉพาะ incident ที่ยังเปิด; admin/eoc/ddpm เห็นทุก incident รวมที่ปิดแล้ว
- โหมดวิกฤต **เปิดทับ**โหมดปกติ ไม่ใช่ระบบแยก — ทะเบียน/ข้อมูลชุดเดียวกัน
- เก็บ scope ปัจจุบันไว้ใน cookie (`scope-cookie.ts`); helper หลักอยู่ที่ `lib/incident-scope.ts` + `lib/incident-area-match.ts` (`memberMatchesAreas`, `areaMemberWhere`)

---

## 4. ผู้ใช้และบทบาท (Roles)

ระบบมี 9 บทบาท (ดู `src/lib/roles.ts`) — UI/ปุ่ม/ฟอร์มปรับตามบทบาทและโหมด

| role | ป้ายชื่อ | งานหลัก |
| --- | --- | --- |
| `admin` | ผู้ดูแลระบบ | ตั้งค่าระบบทั้งหมด, จัดการผู้ใช้/ทะเบียน, อนุมัติสิทธิ์ |
| `eoc` | ผู้บัญชาการ EOC | ภาพรวมทั้งหมด, เปิด/จัดการเหตุการณ์, แบ่งโซนทีมกู้ภัย, ตัดสินใจเชิงยุทธศาสตร์ |
| `officer` | เจ้าหน้าที่ รพ.สต./โรงพยาบาล | คัดกรองความเร่งด่วน (triage), จัดสรรทีม, ปิดเคส, ดูแลทะเบียนวันปกติ |
| `vhv` | อสม. (ภาคสนาม) | บันทึกเยี่ยมสุขภาพ, คัดกรองจิตใจ, ยื่นคำร้อง — *mobile-first, low-connectivity* |
| `ems` | กู้ชีพ EMS | รับมอบหมายเคสฉุกเฉินทางการแพทย์ |
| `rescue` | กู้ภัย | รับมอบหมายภารกิจกู้ภัย/อพยพ |
| `shelter_manager` | ผู้จัดการศูนย์พักพิง | จัดการเฉพาะศูนย์ที่ถูก assign (ผ่านตาราง `shelter_staff`) |
| `ddpm` | ปภ. (ระดับชาติ) | มุมมองข้ามจังหวัด |
| `viewer` | ผู้ดู (อ่านอย่างเดียว) | ดูข้อมูลในจังหวัดที่สังกัด |

- **บทบาทที่ผู้ใช้ขอเองได้** (ตอนลงทะเบียน/ขอสิทธิ์): officer, eoc, vhv, ems, rescue, shelter_manager, viewer — **ตัด admin/ddpm ออก** (ต้องให้ผู้ดูแลระดับชาติกำหนดเท่านั้น)
- ทุกผู้ใช้ผูกกับ **จังหวัดสังกัด (`province`)** = กุญแจ scope ข้อมูลทั้งระบบ

---

## 5. สถาปัตยกรรม & เทคโนโลยี

- **Framework:** Next.js 16 (App Router, React 19, Server Components) + TypeScript
- **ฐานข้อมูล:** PostgreSQL ผ่าน **Drizzle ORM** (schema: `src/db/schema.ts`, migrations: `src/db/migrations/`, config: `drizzle.config.ts`)
- **Authentication:** NextAuth v5 (beta) + `@auth/drizzle-adapter`
- **แผนที่:** Leaflet + react-leaflet + marker cluster + heatmap (`leaflet.markercluster`, `leaflet.heat`)
- **UI:** Tailwind CSS v4 + shadcn + Base UI + Lucide icons; ธีมตาม `DESIGN.md` (light, semantically colorful)
- **Export:** ExcelJS (เช่น export roster EOC); QRCode (โปสเตอร์แจ้งเหตุ)

### โครงสร้างโค้ด
```
src/
  app/
    (admin)/admin/...   ← หน้าหลังบ้าน (EOC, ทะเบียน, ตั้งค่า) — มี route group
    (public)/           ← map (แผนที่เต็มจอ), report (แจ้งเหตุประชาชน)
    api/                ← REST route handlers ทั้งหมด (~70 endpoints)
    login / register / request-access
  components/
    forms/  map/  panels/  report/  rescue/  shell/  ui/
  db/        ← schema.ts, migrations/, seed-*.ts
  lib/       ← business logic (auth, scope, geo, water-level, flood-risk, audit, ...)
  middleware.ts  ← ส่ง x-pathname header ให้ layout ทำ route guard
```

### Route guard
`middleware.ts` ทำ matcher บน `/admin/*` และ `/map/*` แล้วส่ง `x-pathname` ผ่าน header ให้ server layout ตรวจว่า role นั้นเห็นเมนู/เข้าหน้านี้ได้หรือไม่ (อ้างอิงจาก menu access registry + override table)

---

## 6. โครงสร้างข้อมูล (Domain Model)

> รายละเอียดเต็มอยู่ที่ `src/db/schema.ts` — ส่วนนี้สรุปความหมายและความสัมพันธ์

### 6.1 ทะเบียนประชากร/ครัวเรือน (Family Folder)
- **`households`** — ครัวเรือน (หมุด = บ้าน): บ้านเลขที่, หมู่บ้าน/หมู่ที่/รหัสหมู่บ้าน, ตำบล/อำเภอ/จังหวัด, พิกัด lat/lng
- **`household_members`** — "คน" หนึ่งคน (ทะเบียนประชากร + ส่วนขยายสุขภาพในตารางเดียว)
  - `householdId` เป็น nullable → รองรับคนที่กรอกเดี่ยว (manual/ingest) ที่ยังไม่ผูกครัวเรือน
  - ข้อมูลบุคคล: ชื่อ-สกุล, เลขบัตร 13 หลัก (PDPA), วันเกิด/อายุ/เพศ, เบอร์, สัญชาติ, ประวัติแพ้อาหาร/ยา
  - **คนที่อยู่ในทะเบียนกลุ่มเปราะบาง = แถวที่ `type` IS NOT NULL** (`bedridden | elderly | disabled | pregnant | other`)
  - **`life_support`** (jsonb array) = อุปกรณ์พยุงชีพที่ต้องนำติดตัว: `oxygen | dialysis_capd | dialysis_hd | ventilator | anti_seizure | feeding_tube` → ใช้คำนวณ ribbon "พึ่งอุปกรณ์พยุงชีพ", bring-list, คะแนน survivability
  - การดูแล: `assignedVhvId`, `careUnit` (รพ.สต.), `caregiverPhone`, `medicalPriority` (A/B/C), `followUpStatus`, วันเยี่ยม/ติดต่อล่าสุด
  - source tracking: `sourceSystem` (jhcis/hosxp/manual/import), unique index กัน duplicate จากแหล่งเดิม; soft delete ผ่าน `deletedAt`

### 6.2 ภูมิศาสตร์มาตรฐาน (DOPA)
- **`geo_provinces` → `geo_districts` → `geo_subdistricts`** — จังหวัด/อำเภอ/ตำบล ตามกรมการปกครอง (พร้อมรหัสไปรษณีย์) ใช้เป็น master ของ dropdown และการ scope

### 6.3 เหตุการณ์ภัยพิบัติ (Incident)
- **`incidents`** — เหตุการณ์ (โหมดวิกฤต): ชื่อ, ประเภท (flood/storm/other), สถานะ (active/monitoring/closed), พื้นที่หลัก, ช่วงเวลา
- **`incident_areas`** — พื้นที่ที่ได้รับผลกระทบ (1→N, hierarchical) = scope จริงในการกรองข้อมูล

### 6.4 ระดับน้ำ & GIS น้ำท่วม
- **`water_station`** — สถานีวัดน้ำ + เกณฑ์ (warning/prepare/critical/danger level, rapid-rise threshold) — ไม่ hardcode ชื่อสถานี
- **`water_station_pair`** — คู่สถานี upstream→downstream ต่อลุ่มน้ำ (ใช้ทำนาย/เชื่อมโยง)
- **`flood_points`** — จุดน้ำท่วมจาก Sentinel-1 SAR (lat/lng/intensity/observedAt)
- **`flood_polygons`** — พื้นที่น้ำท่วม GeoJSON จาก Sentinel-2/GISTDA
- **`user_flood_marks`** — จุดระดับน้ำที่ผู้ใช้ปักเอง (เผื่อจังหวัดที่ไม่มีข้อมูล CMU): ระดับ cm → level 1–5, มีรหัสจุดอ่านง่ายต่อจังหวัด (เช่น `CR_00001`) ผ่าน `user_flood_mark_code_seq` (atomic running number)
- **`flood_risk_zones`** — **โซนพื้นที่เสี่ยงที่เจ้าหน้าที่วาด polygon เอง** (scope ตามจังหวัด): `category` permanent/temporary, `hazardType` (flood/earthquake/epidemic/other), priority, สี; polygon เก็บเป็น `[lng,lat][]` เพื่อทำ point-in-polygon นับกลุ่มเปราะบาง
  - **เกณฑ์ "ในเขตน้ำท่วม"** ใช้เฉพาะ `hazard_type='flood'` + buffer รอบ polygon (~1 กม.) — ดู `lib/flood-risk.ts` / `lib/flood-area.ts`
- **`hazard_types`** — ทะเบียนชนิดภัย (ตั้งค่าได้ที่ `/admin/settings/hazard-types`); `isSystem` = ชนิดหลักลบไม่ได้

### 6.5 ปฏิบัติการภาคสนาม & คำร้อง
- **`health_visits`** — บันทึกเยี่ยมของ อสม.: สถานะการเยี่ยม, สถานะบุคคล (safe/needs_help/evacuated/referred), ประเมินคลินิก (`vitalStatus`), จิตใจ (`mentalStatus`), ธง `needsMcat`, `medSufficient` (ยาพอเกิน 7 วัน), `oxygenReady`
- **`help_requests`** — คำร้องขอความช่วยเหลือ (จาก vhv/eoc/ems/officer/public): `requestType` (medical/evacuation/supplies/rescue/shelter/other), `priority` (low/normal/high/critical), `status` (new → triaged → assigned → en_route → resolved/cancelled)
- **`public_help_reports`** — **คำร้องจากประชาชน** ที่แจ้งเองผ่านฟอร์มสาธารณะ `/report` (ยังไม่ยืนยันตัวตน → ต้องผ่าน จนท. ตรวจสอบ): status pending/approved/rejected; **approve → สร้าง `help_requests` จริง** เข้าคิว EOC
- **`case_assignments`** — timeline การมอบหมายเคสให้ทีม (assigned → accepted → en_route → arrived → transferred → closed), ผูก rescue team จากทะเบียนหรือทีมนอกทะเบียน (text), ETA

### 6.6 ทีมกู้ภัย
- **`rescue_teams`** — ขึ้นทะเบียนหน่วย: `teamType` (rescue_boat/gmc_truck/ems_medical/mcat_psych/volunteer_kitchen/other), **`zone`** = โซนรับผิดชอบ (กันเข้าช่วยซ้ำซ้อน/บ้านถูกทิ้ง), status (active/standby/offline), พิกัด

### 6.7 ศูนย์พักพิง & ส่งต่อ
- **`infrastructures`** — สถานที่ (hospital/clinic/shelter/assembly/evacuation_point...): ความจุ/occupancy, `readinessStatus` (open/near_capacity/full/closed/unsafe), ความพร้อมสุขภาพ (bedriddenCapacity, oxygenSupport, wheelchairSupport, electricitySupport), `accessModes` (vehicle/boat/foot)
- **`shelter_zones`** — โซนรับเข้าภายในศูนย์ (กำหนดเองต่อศูนย์ เช่น "ติดเตียง-ส่งต่อ รพ.")
- **`shelter_admissions`** — การรับเข้ารายคน: ผูก member/incident/help_request/zone, ทีมที่นำส่ง, exit reason/destination
- **`shelter_status_snapshots`** — snapshot ความจุ/ความพร้อมตามช่วงเวลา
- **`shelter_staff`** — ผูกผู้ใช้ (shelter_manager) กับศูนย์ที่ดูแล (1 คน → หลายศูนย์)
- **`hospital_referrals`** — ส่งต่อจากศูนย์พักพิง → สถานพยาบาล: ปลายทางในระบบหรือนอกระบบ (text), priority, status (pending → accepted → en_route → arrived → admitted/rejected/cancelled) → ปลายทางเห็นเคสที่กำลังมาผ่าน inbox

### 6.8 รายงานสถานการณ์ (SITREP) & ตัวนับ
- **`incident_casualties`** — บันทึกผู้บาดเจ็บ/เสียชีวิต/สูญหาย/ป่วย ราย event (type/severity/cause)
- **`disease_surveillance`** — ยอดโรคเฝ้าระวังรายวันต่อกลุ่มอาการ (น้ำกัดเท้า/ท้องเสีย/ไข้/ตาแดง/ทางเดินหายใจ/เครียด/เลปโตฯ)
- **`sit_reports`** — ใบสรุปสถานการณ์ (hybrid): ตัวเลข auto-aggregate จากระบบ + ฟิลด์ที่กรอกเอง (manual jsonb, มาตรการ, แผน); ตอน publish จะ freeze `autoSnapshot`

### 6.9 ระบบ & ความปลอดภัย
- **`users`** — ทะเบียนเจ้าหน้าที่: `cidHash` (SHA-256 ของ CID = กุญแจตัวตนหลัก match ทุกช่องทาง), `ssoSubject` (กุญแจ login รองสำหรับ dedupe ข้ามช่องทาง), role, province, status (pending/active/suspended), `registeredVia` (thaid/whitelist/credentials)
- **`unit_api_keys`** — API key ของหน่วยบริการ (รพ.สต./อปท.) ที่ส่งข้อมูลเข้าระบบ (`/api/ingest/*`)
- **`access_log`** — **audit log (PDPA)**: ทุกการเปลี่ยนข้อมูล + การเข้าถึงข้อมูลส่วนบุคคล (action/entity/targetId/method/metadata/ip); metadata **ห้ามเก็บ PII ดิบ**
- **`menu_role_access`** — override การเห็นเมนูต่อ role (ถ้าไม่มี row → ใช้ default จาก `lib/menus.ts`)

---

## 7. โมดูลฟีเจอร์ (Feature Modules)

### 7.1 ทะเบียนกลุ่มเปราะบาง & Family Folder
- หน้า `/admin/vulnerable` (ทะเบียนกลุ่มเปราะบาง) และ `/admin/family-folder` (มุมมองรายหมู่บ้าน + worklist + เรียงตามความเสี่ยงตอนวิกฤต)
- หลักการ "หมุด = บ้าน": popup แสดงสมาชิกทุกคน + เบอร์ทุกคน + อุปกรณ์พยุงชีพ
- ปักตำแหน่งด้วย **LocationPicker บนแผนที่เสมอ** (`src/components/forms/LocationPicker.tsx`) — ห้ามให้กรอก lat/lng เป็นตัวเลขเอง

### 7.2 ปฏิบัติการภาคสนาม (อสม.)
- บันทึกเยี่ยมสุขภาพ (`health_visits`), คัดกรองจิตใจ → ธง MCAT, ตรวจความพร้อมยา/ออกซิเจน, ยื่นคำร้องพร้อมพิกัด
- ออกแบบ mobile-first สำหรับพื้นที่สัญญาณอ่อน

### 7.3 ศูนย์บัญชาการ EOC (`/admin/eoc`)
- Operations console ตอบ "น้ำอยู่ไหน + ใครเสี่ยง + ทีมไหนทำอะไรแล้ว"
- Status ribbon (เปราะบางทั้งหมด/ต้องการช่วย/ปลอดภัย/ทีมกู้ภัย) + 3 แท็บ (พื้นที่/คำร้อง/ทีมกู้ภัย) + แผนที่ Leaflet
- **Geo drill-down:** อำเภอ → ตำบล → หมู่บ้าน → รายชื่อ (เห็นชื่อบุคคลเฉพาะเมื่อ drill ถึงระดับหมู่บ้าน — คุม PDPA)
- โหมดปกติ: เรียงหมู่บ้านที่ขาดการดูแลมากสุดขึ้นก่อน (coverage %)
- หน้าย่อย: `/admin/eoc/roster` (กำลังพล + export Excel), `/admin/eoc/sitrep` (ใบสรุปสถานการณ์)

### 7.4 คัดกรองคำร้อง (Triage) & กู้ภัย
- Triage จัดลำดับ critical/high/normal/low; มอบหมายทีม (`case_assignments`); ติดตามสถานะตาม timeline
- `/admin/rescue-teams` ขึ้นทะเบียนหน่วย + แบ่งโซน; `/admin/rescue-missions` จับคู่ทีม–ภารกิจ

### 7.5 ระดับน้ำ & GIS (`/admin/water-level`, `/map`)
- รับค่าระดับจากสถานี → เทียบเกณฑ์เตือน; เชื่อม CMU Flood Alert + GISTDA (proxy ผ่าน `/api/cmu-flood/*`, `/api/gistda/*`)
- วาดโซนเสี่ยง (`flood_risk_zones`) บนแผนที่; ปักจุดระดับน้ำเอง (`user_flood_marks`)
- เกณฑ์ "ในเขตน้ำท่วม" = polygon flood + buffer ~1 กม. → ใช้คัดบ้านที่ต้องเฝ้าระวังอัตโนมัติ

### 7.6 แจ้งเหตุด้วยตนเอง (ประชาชน) (`/report`)
- ฟอร์มสาธารณะ (มีหน้าโปสเตอร์/QR ที่ `/report/poster`) → `public_help_reports`
- เข้ากล่อง **"รอตรวจสอบ"** ที่ `/admin/help-reports` → จนท. approve สร้างคำร้องจริงเข้าคิว EOC, หรือ reject

### 7.7 ศูนย์พักพิง & ส่งต่อโรงพยาบาล
- `/admin/shelters` จัดการความจุ/ความพร้อมสุขภาพ/โซน/รับเข้ารายคน
- `/admin/referrals` inbox ส่งต่อ รพ. (ปลายทางเห็นเคสที่กำลังมา + ติดตามสถานะ)

### 7.8 ตั้งค่าระบบ (`/admin/settings`)
- จัดการ: staff, facilities, incidents, hazard-types, rescue-teams, shelter-managers, **menus** (สิทธิ์เห็นเมนูต่อ role)

---

## 8. เรื่องตัดขวาง (Cross-cutting)

### 8.1 Authentication & Authorization
- **แยก authentication (ใครคือใคร) ออกจาก authorization (ทำอะไรได้)** อย่างชัดเจน
- ช่องทาง login: **ThaiD (Digital ID)** เป็นหลัก (ปัจจุบันเป็น `thaid-sim` รอต่อ OAuth จริง — flow เดียวกัน: คืน CID → `resolveStaffByCid`), credentials สำหรับ dev, รองรับ SSO `provider_id`
- ตัวตนผูกด้วย **`cidHash`** (match ข้ามทุกช่องทาง) + `ssoSubject` (dedupe กรณีไม่มี CID)
- **Flow ขอสิทธิ์ผู้ใช้ใหม่:** login ผ่าน SSO/ThaiD แล้วยังไม่มีสิทธิ์ → status `pending` → ถูก gate ไป `/request-access` (เลือกจังหวัด + role ที่ requestable) → admin/EOC อนุมัติ → status `active`
- การเข้าถึงข้อมูลทุกอย่าง **scope ตามจังหวัดสังกัด** ของผู้ใช้

### 8.2 Multi-province (ข้อกำหนดสำคัญ)
- **ห้าม hardcode** ชื่อจังหวัด/อำเภอ/ตำบล/สถานีวัดน้ำ/ชื่อศูนย์พักพิงใดๆ — ทุกอย่างเป็น data ที่ configure ต่อจังหวัดได้ เพื่อให้จังหวัดอื่นนำไปใช้โดยไม่แก้โค้ด

### 8.3 PDPA & Audit
- ข้อมูลสุขภาพ/เลขบัตรเปิดเฉพาะผู้ได้รับอนุญาต; เห็นชื่อบุคคลเฉพาะเมื่อ drill ถึงระดับหมู่บ้าน
- เลขบัตรแสดงแบบ masked; การเปิดดูเลขเต็มมี endpoint เฉพาะ (`/api/household-members/[id]/national-id`) และถูก log
- **ทุก mutating route + การเข้าถึง PII ถูกบันทึกผ่าน `lib/audit.ts` → `access_log`** (metadata ห้ามมี PII ดิบ)

### 8.4 Menu Access Control
- Registry กลางที่ `lib/menus.ts` (default ต่อ role) + override table `menu_role_access` (ตั้งที่ `/admin/settings/menus`)
- คุมแค่ "การเห็น/เข้าหน้า" ไม่ใช่สิทธิ์ระดับ API — API ตรวจสิทธิ์แยกของตัวเอง

### 8.5 External Integrations
- **CMU Water Center / Flood Alert** — ข้อมูลระดับน้ำ/แจ้งเตือน (`/api/cmu-flood/*`, `/api/cmu-flood-alert`)
- **GISTDA** — ข้อมูลภาพถ่ายดาวเทียม/พื้นที่น้ำท่วม (`/api/gistda/*`)
- **Sentinel-1/2 SAR** — flood points/polygons
- **JHCIS/HosXP** — นำเข้าทะเบียนประชากร (ผ่าน `source_system` + `/api/ingest/vulnerable` ด้วย unit API key)

---

## 9. หลักการออกแบบ (Design Principles)

> ระบบดีไซน์เต็มอยู่ที่ `DESIGN.md` — สรุปหลักการ:

1. **หน้าจอเดียว ตอบคำถามเดียวที่สำคัญ** — ไม่ยัดทุกอย่างในจอเดียว
2. **สถานะมาก่อน chrome** — แถบ stats สำคัญอยู่บนสุด
3. **จบที่การลงมือ (action over information)** — ทุก detail view จบด้วยปุ่มกริยา (โทร/บันทึกเยี่ยม/ขอ EMS/จัดทีม/อพยพแล้ว)
4. **สีเป็นภาษา** — แดง=วิกฤต/ในเขตน้ำท่วม, เหลือง/ส้ม=เฝ้าระวัง, เขียว=ปลอดภัย, น้ำเงิน=อพยพแล้ว/ข้อมูล, คราม=โครงสร้างพื้นฐาน
5. **เข้าถึงได้ (WCAG 2.2 AA)** — สื่อสถานะด้วยไอคอน+ข้อความ+ตำแหน่ง ไม่พึ่งสีอย่างเดียว; เคารพ reduced-motion
6. **ทวิภาษา** — ไทยเป็นหลัก, ตัวเลข/เวลาเป็น Latin/mono

---

## 10. ขอบเขต & สถานะ

### อยู่ในขอบเขต (v1)
ทุกโมดูลในข้อ 7 ทำงานได้: ทะเบียน, ภาคสนาม, EOC, triage/กู้ภัย, น้ำ/GIS, แจ้งเหตุประชาชน, ศูนย์พักพิง/ส่งต่อ, ตั้งค่า, auth/PDPA

### นอกขอบเขต (v1)
- ไม่มี public registration ที่สร้างสิทธิ์เอง (admin/EOC อนุมัติเสมอ)
- ไม่มีโมดูล logistics อาหาร/น้ำเต็มรูป (เก็บเฉพาะที่กระทบความพร้อมสุขภาพของศูนย์พักพิง)
- ไม่มี incident command ดับเพลิง/กู้ภัยเต็มรูปเกินที่จำเป็นต่อการดูแลกลุ่มเปราะบาง
- ไม่มีฟีเจอร์ social/sharing

### หมายเหตุการพัฒนา
- บางฟิลด์เชิงความสัมพันธ์ในครัวเรือน (`is_head`, `family_position`) ยังไม่มีช่องกรอกจริงในบาง flow — ป้ายที่เกี่ยวข้องถูกซ่อนชั่วคราวบาง view
- ThaiD ปัจจุบันเป็น simulation รอเชื่อม OAuth จริง (flow ออกแบบไว้ให้สลับได้โดยไม่กระทบส่วนอื่น)
