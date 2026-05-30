# Phase G: Incident Scope — สถานะ

อัปเดตล่าสุด: 2026-05-30

## ปัญหาที่แก้

ทุกหน้า (EOC / shelters / map / rescue / requests) ปัจจุบันแสดงข้อมูล "รวมทุกเหตุการณ์" ทำให้ commander/operator สับสนว่าเคสไหนเป็นของน้ำท่วมรอบไหน ปิดแล้วหรือยัง และ "ขณะนี้กำลังจัดการอันไหน"

**เป้าหมาย:** ผู้ใช้เลือก "เหตุการณ์ที่กำลังจัดการ" ทีละ 1 เหตุการณ์ จากนั้นทั้งระบบ filter ตาม `incidentId` นั้น (pattern คล้าย workspace switcher ของ Linear/incident.io)

## หลักการ

1. **ผู้ใช้เลือกเอง ไม่ auto-pick** — เปิดระบบมาเริ่มที่ "โหมดปกติ" หรือเลือกเหตุการณ์เอง
2. **ทีละเหตุการณ์** — บังคับ focus, ไม่มีโหมดดูหลายเหตุการณ์ผสมกัน
3. **โหมดปกติ (ไม่มี incident)** = ทะเบียนสุขภาพประจำ (registry + visits ตามตำบล/หมู่บ้าน) เพื่อ "เตรียมพร้อมรับมือหากต้องเผชิญเหตุอีก"
4. **โหมดวิกฤต (มี incident)** = ทุก operational entity (admissions/requests/visits/teams) scope ตาม `incidentId`

## สิทธิ์ (เริ่มแบบง่าย — Option A)

| Role | สิทธิ์เลือกเหตุการณ์ |
|---|---|
| `admin`, `eoc`, `ddpm` | เห็นและเลือกได้ทุกเหตุการณ์ (รวม `closed`) |
| `officer`, `vhv`, `ems` | เห็นและเลือกได้เฉพาะเหตุการณ์ที่ `status != 'closed'` |

> Upgrade path: ภายหลังเพิ่มตาราง `incident_members` (user × incident) เมื่อมีผู้ใช้จริงหลายคนและต้องการจำกัดต่อพื้นที่ — ยังไม่ทำตอนนี้เพื่อไม่ขยาย scope

## งานในเฟส

### G1 · Foundation ✅
- [x] `src/lib/incident-scope.ts` — `getActiveIncidentId/getActiveIncident/getSelectableIncidents/setIncidentCookie/clearIncidentCookie/canSeeClosedIncidents`
- [x] `POST /api/incident-scope` — ตั้ง/ล้าง cookie (validate ว่า incident มีอยู่จริงและ user มีสิทธิ์)
- [x] `IncidentScopeProvider` client context — รับ active + selectable จาก server
- [x] `IncidentSwitcher` บน `Masthead` (ขวาบน ข้าง RoleSwitcher) — แดงเมื่อมี active, เทาเมื่อโหมดปกติ
- [x] `IncidentBanner` sticky ใต้ Masthead — แดง/เหลือง/เทาตาม status, มีปุ่ม "ออกจากโหมดวิกฤต"
- [x] เสียบใน `(admin)/admin/layout.tsx` — ทุกหน้า admin มี scope + banner

### G2 · Crisis-mode pages (filter by incidentId) ✅
- [x] `/admin/eoc` — persons filter ตามพื้นที่ของ incident (tambon → amphoe → province), rescueTeams + helpRequests filter by `incidentId`
- [x] Schema: เพิ่ม `shelter_admissions.incident_id` (migration `0017_left_doctor_doom.sql` — `ADD COLUMN incident_id uuid REFERENCES incidents(id)`)
- [x] `POST /api/shelters/:id/admissions` — บันทึก current scope's incidentId อัตโนมัติ
- [x] `GET /api/shelters/:id/admissions` — filter by scope (override ด้วย `?scope=all`)
- [x] `/admin/shelters` (list) — occupancy counts filter by scope; banner บอกว่ากำลังนับของ scope ไหน
- [x] `/admin/shelters/[id]` — rescue teams filter by scope (admissions ผ่าน API จึง auto-filter)
- [x] `GET /api/rescue-teams` — filter by scope (override `?scope=all`); `POST` บันทึก current incidentId
- [x] `/admin/incidents` — เพิ่มปุ่ม "จัดการเหตุการณ์นี้" บนแต่ละแถว → set scope + เด้งไป `/eoc`
- [ ] `/admin/water-level` + `/map` — ยังไม่ scope (sensor data ไม่ผูก incident โดยตรง; ทำตอน G4 ถ้าจำเป็น)

### G3 · Normal-mode view (ไม่มี incident)
- [ ] `/admin/eoc` เปลี่ยนเป็น "ภาพรวมพื้นที่รับผิดชอบ":
  - drill เดียวกัน แต่นับ "ผู้เปราะบางทั้งหมดตามอำเภอ"
  - coverage รายหมู่บ้าน: "วันตั้งแต่ visit ล่าสุด" + "% ที่ visit ใน 90 วันล่าสุด"
  - ไม่แสดง admissions / requests
- [ ] Banner "โหมดปกติ — ไม่มีเหตุการณ์เปิดอยู่" (เตือนให้เลือกถ้ามีเหตุ)

### G4 · Hardening
- [ ] Cookie อายุยาว (30 วัน) + clear เมื่อ logout
- [ ] ตรวจสิทธิ์ฝั่ง server ทุก API ที่อ่าน incident scope (ไม่เชื่อ cookie อย่างเดียว)
- [ ] เพิ่ม index `(incident_id, observed_at desc)` บน health_visits / help_requests ถ้า query ช้า

## Out of scope (เฟสนี้)
- ตาราง `incident_members` (assign user → incident)
- Per-area assignment (user.assignedAmphoe)
- Audit log ของการสลับ scope
