# Health-first Implementation Phases

อัปเดตล่าสุด: 2026-05-31  
เอกสารนี้คือ phase plan สำหรับเริ่มเปลี่ยน FloodWatch จาก flood map MVP ไปเป็นระบบปฏิบัติการด้านสาธารณสุขในสถานการณ์น้ำท่วม

## Phase 0: Grounding ✅

เป้าหมาย: ให้ทีมและ agent เข้าใจ product scope เดียวกัน

- สรุป SRS และ health-first context ใน `/docs`
- อัปเดต `PRODUCT.md`
- เชื่อมต่อ local Postgres และยืนยันว่า DB ว่างพร้อมเริ่ม migration

## Phase 1: Health Operations Data Foundation

เป้าหมาย: ทำให้ฐานข้อมูลรองรับ workflow สาธารณสุขโดยไม่เปลี่ยน UI หนักทันที

- เพิ่ม field สำคัญให้ทะเบียนกลุ่มเปราะบาง เช่น medical priority, follow-up status, assigned unit, last contacted/visited
- เพิ่ม field ให้ศูนย์พักพิง เช่น occupancy, readiness status, health capacity, oxygen/electricity/wheelchair support
- เพิ่มตารางสำหรับ อสม. visit, help request, case assignment, shelter status snapshot, shelter admission
- push schema เข้า Postgres local
- seed demo data เดิมให้รันกับ schema ใหม่ได้

Definition of done:

- `npm run db:push` สำเร็จ
- DB มีตาราง health-first ครบ
- `npm run build` ผ่าน หรือระบุ blocker ที่ชัดเจน

## Phase 2: Field Workflow API

เป้าหมาย: ให้ อสม./เจ้าหน้าที่ภาคสนามส่งข้อมูลได้จริงผ่าน API

- `GET /api/field/tasks` สำหรับรายการกลุ่มเปราะบางที่ต้องติดตาม
- `POST /api/health-visits` สำหรับบันทึกผลเยี่ยมบ้าน
- `POST /api/help-requests` สำหรับส่งคำร้องพร้อมพิกัดและ priority
- บันทึก `observed_at` และ `synced_at` เพื่อรองรับ offline sync
- เพิ่ม validation และ role guard

## Phase 3: EOC Triage Queue

เป้าหมาย: ให้ command center เห็นงานที่ต้องตัดสินใจก่อน

- Queue คำร้องขอความช่วยเหลือตาม priority/status
- แสดงว่าคำร้องเกี่ยวกับคนในทะเบียนหรือไม่
- ยกระดับ priority เมื่อเป็น medical priority สูงและอยู่ในพื้นที่ `flood`/`near`
- มอบหมาย EMS/กู้ภัย/ทีมพื้นที่
- อัปเดต status timeline

## Phase 4: Shelter Health Management

เป้าหมาย: ให้ศูนย์พักพิงเป็น operational object ไม่ใช่แค่ marker บนแผนที่

- CRUD/read model สำหรับ shelter occupancy และ health readiness
- บันทึก snapshot ความจุแบบ time-series
- รับตัวผู้ป่วย/กลุ่มเปราะบางเข้าสู่ shelter
- เช็ค suitability เช่น wheelchair, oxygen, electricity, caregiver support

## Phase 5: Mobile-first VHV Experience

เป้าหมาย: ทำ workflow อสม. ให้ใช้ได้จริงในพื้นที่

- หน้ารายการงานของ อสม. แบบ mobile-first
- Bottom sheet/detail form ด้วย shadcn/ui primitives
- Offline outbox บน client
- Sync status และ conflict handling เบื้องต้น

## Phase 6: Operational Hardening

เป้าหมาย: ทำให้ระบบพร้อมใช้งานในสถานการณ์จริง

- Audit log สำหรับการเปิดดูข้อมูลส่วนบุคคล
- PDPA masking ตาม role
- Load/performance check กับจำนวนคนและจุดน้ำท่วมที่มากขึ้น
- Real-time update ภายใน 1 นาทีด้วย polling/SSE/WebSocket ตามข้อจำกัด deploy
- Export/after-action review report

---

## Phase G: Incident Scope ✅ (2026-05-31)

เป้าหมาย: ผู้ใช้เลือกเหตุการณ์ที่กำลังจัดการทีละ 1 อัน → ทั้งระบบ filter ตาม incident นั้น

**เสร็จแล้ว:**
- `IncidentScopeProvider` client context + cookie `gx-incident-id` (httpOnly, 30 วัน)
- `POST /api/incident-scope` validate ฝั่ง server (DB lookup + role check)
- `IncidentSwitcher` dropdown บน Masthead — แดงเมื่อมี active, เทาเมื่อโหมดปกติ
- `IncidentBanner` sticky ใต้ Masthead — แดง/เหลือง/เทาตาม status + ปุ่มออกโหมดวิกฤต
- EOC: persons filter ตามพื้นที่ incident (tambon→amphoe→province), teams+requests filter by incidentId
- Shelters: occupancy count + admissions filter by incidentId; schema เพิ่ม `shelter_admissions.incident_id`
- Rescue teams API: GET filter auto, POST บันทึก incidentId
- Incidents list: ปุ่ม "จัดการเหตุการณ์นี้" → set scope + redirect /eoc
- EOC โหมดปกติ: coverage view รายหมู่บ้าน (% เยี่ยมใน 90 วัน + วันล่าสุด), ribbon ต่างจากโหมดวิกฤต
- Migration 0017: `shelter_admissions.incident_id FK`
- Migration 0018: 5 indexes (`idx_*_incident_id` + `idx_health_visits_member_observed`)

**Upgrade path (ยังไม่ทำ):**
- ตาราง `incident_members` สำหรับ assign operator → incident ต่อพื้นที่
- `user.assignedAmphoe` สำหรับ auto-scope ตามพื้นที่รับผิดชอบ

---

## Phase E: Operations Counters + Surveillance (รอดำเนินการ)

เป้าหมาย: นับ dispatch ทีม, ผู้บาดเจ็บ/เสียชีวิต, โรคเฝ้าระวัง, จำนวนบริการ — สำหรับ Sit Rep อัตโนมัติ

## Phase F: Situation Report (รอดำเนินการ)

เป้าหมาย: หน้า Sit Rep hybrid — auto-aggregate จากข้อมูลในระบบ + manual fields บางส่วน (เช่น ความเสียหายโครงสร้าง)
รูปแบบ: ตาม TABLE_Situation_Report.md ใน docs/
