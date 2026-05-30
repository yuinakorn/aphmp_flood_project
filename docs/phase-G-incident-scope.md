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

### G3 · Normal-mode view ✅
- [x] `CoverageRow` type ใน `src/types/index.ts` (amphoe/tambon/vil/totalMembers/visitedIn90d/pct90d/lastVisitAt/daysSinceLastVisit)
- [x] Coverage query ใน `eoc/page.tsx`: JOIN household_members + health_visits → GROUP BY amphoe/tambon/village → นับ `visited_in_90d` + MAX(observed_at)
- [x] Ribbon โหมดปกติ: กลุ่มเปราะบาง · เยี่ยมใน 90 วัน · ครอบคลุม % · ยังไม่เคยเยี่ยม · หมู่บ้าน
- [x] Banner "โหมดปกติ — แสดงความครอบคลุมการเยี่ยม..." ใต้ ribbon
- [x] `coverageScoped` memo: aggregate ตาม drill level (amphoe→tambon→vil)
- [x] Coverage card list: progress bar สี + "เยี่ยมล่าสุด X วันก่อน" + drill ลงได้
- [x] View-mode toggle ซ่อนในโหมดปกติ (ไม่มี crisis table)
- [x] Search ในโหมดปกติ → แสดง flat people list

### G4 · Hardening ✅
- [x] Cookie `gx-incident-id` maxAge 30 วัน, httpOnly, sameSite=lax
- [x] `getActiveIncident()` validate ฝั่ง server (query DB + role check) ก่อน return — ถ้าไม่ผ่านล้าง cookie
- [x] Migration `0018_regular_steel_serpent.sql`: 5 indexes ใหม่
  - `idx_health_visits_incident_id` ON health_visits(incident_id)
  - `idx_health_visits_member_observed` ON health_visits(member_id, observed_at)
  - `idx_help_requests_incident_id` ON help_requests(incident_id)
  - `idx_rescue_teams_incident_id` ON rescue_teams(incident_id)
  - `idx_shelter_admissions_incident_id` ON shelter_admissions(incident_id)
- [x] Audit ทุก mutating API route → ทุกตัวมี `auth()` + `canTriage()`/`unauthorized()` guard ครบ

## Out of scope (เฟสนี้)
- ตาราง `incident_members` (assign user → incident)
- Per-area assignment (user.assignedAmphoe)
- Audit log ของการสลับ scope
