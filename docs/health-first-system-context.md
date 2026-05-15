# Health-first Flood Disaster Management Context

เอกสารนี้สรุปทิศทางระบบจาก `SRS_Flood_Disaster_Management.docx` และบริบทโปรเจคปัจจุบัน เพื่อให้ agent และทีมพัฒนาเข้าใจตรงกันว่า FloodWatch จะขยายไปทางใดต่อไป

แหล่งข้อมูลหลัก:

- SRS: `/Users/yuinakorn/Downloads/SRS_Flood_Disaster_Management.docx`
- วันที่ใน SRS: 14 พฤษภาคม 2569
- เวอร์ชันใน SRS: 0.2 Draft
- เอกสารโปรเจคเดิม: `README.md`, `PRODUCT.md`, `DESIGN.md`

## Product Direction

ระบบนี้คือ Web/Mobile Application สำหรับจัดการภัยพิบัติน้ำท่วมโดยใช้แผนที่, GIS, ข้อมูลกลุ่มเปราะบาง, ศูนย์พักพิง, จุดอันตราย, และคำร้องขอความช่วยเหลือ เพื่อให้ศูนย์บัญชาการและเจ้าหน้าที่ภาคสนามตัดสินใจได้เร็วขึ้น

สำหรับเฟสถัดไปของโปรเจคนี้ ให้โฟกัสงานด้านสาธารณสุขก่อน ไม่ใช่ระบบภัยพิบัติเต็มรูปแบบทั้งหมด:

1. การจัดการผู้ป่วยและประชาชนกลุ่มเปราะบาง
2. การดำเนินกิจกรรมของ อสม. ในพื้นที่
3. การจัดการศูนย์พักพิงและความพร้อมด้านสาธารณสุขในศูนย์พักพิง

ฟีเจอร์อื่นจาก SRS เช่น food logistics, fire incident, rescue dispatch, danger point และ public call-for-help ยังสำคัญ แต่ให้ถือเป็น adjacent scope หลังจาก health-first workflow ชัดเจนแล้ว

## Core Operating Question

ระบบควรช่วยตอบคำถามนี้ก่อน:

> ตอนนี้น้ำอยู่ตรงไหน ใครในกลุ่มเปราะบางได้รับผลกระทบ อสม. หรือเจ้าหน้าที่พื้นที่ทำอะไรไปแล้ว และควรส่งใครไปศูนย์พักพิงไหนก่อน

คำถามนี้ต่อยอดจาก `PRODUCT.md` ที่วาง job-to-be-done เดิมไว้ว่า "where is the water now, who is in danger, who do we move first."

## Primary Users

SRS ระบุ 6 role หลัก:

- `EOC`: ศูนย์บัญชาการเหตุการณ์ ดูภาพรวม สั่งการ และประสานทรัพยากร
- `ปภ.`: แจ้งเตือนภัย จัดการอพยพ และบริหารศูนย์พักพิง
- `กู้ภัย`: รับภารกิจค้นหา ช่วยเหลือ และเคลื่อนย้ายผู้ประสบภัย
- `EMS`: ให้การปฐมพยาบาล นำส่งโรงพยาบาล และดูแลผู้ป่วย
- `ดับเพลิง`: จัดการเหตุไฟไหม้ ไฟฟ้ารั่ว หรือเหตุฉุกเฉินในพื้นที่น้ำท่วม
- `อสม.`: สำรวจกลุ่มเปราะบาง รายงานสถานการณ์ในชุมชน และส่งคำร้อง/ข้อมูลภาคสนาม

สำหรับ health-first phase ให้จัดลำดับความสำคัญของ role ดังนี้:

1. `อสม.` เป็นผู้เก็บและอัปเดตข้อมูลหน้างาน
2. `รพ.สต./เจ้าหน้าที่สาธารณสุข/EMS` เป็นผู้ประเมินความเสี่ยงและติดตามผู้ป่วย
3. `EOC/ปภ.` เป็นผู้ดูภาพรวมและจัดลำดับทรัพยากร
4. `กู้ภัย` เข้ามาเมื่อมีการเคลื่อนย้ายหรือคำร้องช่วยเหลือที่ต้อง dispatch

## Health-first Domain Modules

### 1. Vulnerable Patient Registry

ระบบต้องมีทะเบียนกลุ่มเปราะบางที่ใช้งานได้ทั้งช่วงปกติและช่วงเกิดภัย โดยเชื่อมกับพิกัดแผนที่และสถานะน้ำท่วม

กลุ่มข้อมูลหลัก:

- ประเภทกลุ่มเปราะบาง: ผู้ป่วยติดเตียง, ผู้สูงอายุ, ผู้พิการ, หญิงตั้งครรภ์, เด็กเล็ก หรือประเภทที่สาธารณสุขกำหนดเพิ่ม
- ภาวะสุขภาพสำคัญ: โรคประจำตัว, mobility, dependency level, อุปกรณ์จำเป็น, medication dependency
- ตำแหน่งที่อยู่: บ้าน, หมู่บ้าน, ตำบล, พิกัด GPS
- ผู้ติดต่อ/ผู้ดูแล: caregiver, phone, หน่วยบริการประจำ
- สถานะความเสี่ยงจากน้ำท่วม: `flood`, `near`, `safe`
- สถานะการติดตาม: ยังไม่ตรวจเยี่ยม, ติดต่อแล้ว, ต้องช่วยเหลือ, เคลื่อนย้ายแล้ว, ส่งต่อ EMS, ปิดเคส
- consent และ audit log สำหรับ PDPA

ใน repo ปัจจุบันมีฐานที่เกี่ยวข้องแล้ว:

- `vulnerable_persons` ใน `src/db/schema.ts`
- `VulnerablePerson` และ `RiskLevel` ใน `src/types/index.ts`
- `RosterPanel` สำหรับรายชื่อบนแผนที่
- admin page สำหรับทะเบียนกลุ่มเปราะบาง
- `public/data/vulnerable.json` สำหรับข้อมูลตัวอย่าง

สิ่งที่ควรต่อยอด:

- เพิ่มสถานะติดตาม/เยี่ยมบ้าน แยกจากระดับน้ำท่วม
- เพิ่ม owner หรือ assigned อสม./รพ.สต.
- เพิ่ม last contacted / last visited / last known status
- เพิ่ม medical priority เช่น `A`, `B`, `C` ตามแนวคิดใน SRS ที่ระบุว่ากลุ่มเปราะบางระดับ A ควรถูกยกระดับ priority เป็น HIGH

### 2. VHVs Field Operations

อสม. คือ actor สำคัญของเฟสนี้ ไม่ใช่แค่ผู้แจ้งเหตุ แต่เป็นผู้ทำงานซ้ำในพื้นที่:

- สำรวจและยืนยันข้อมูลกลุ่มเปราะบาง
- รายงานสถานการณ์น้ำท่วมในชุมชน
- ส่งคำร้องขอความช่วยเหลือพร้อมพิกัด
- อัปเดตสถานะการติดต่อ/เยี่ยมบ้าน
- แจ้งความต้องการเร่งด่วน เช่น ยา, ออกซิเจน, อาหาร, น้ำดื่ม, การเคลื่อนย้าย
- รับสถานะตอบกลับจาก EOC/EMS/กู้ภัย แบบใกล้ real-time

Workflow ที่ควรออกแบบก่อน:

1. อสม. เปิด mobile view ของพื้นที่รับผิดชอบ
2. เห็นรายชื่อกลุ่มเปราะบางที่ต้องตรวจวันนี้ เรียงตามความเสี่ยง
3. เลือกบุคคล แล้วอัปเดตผลตรวจเยี่ยม
4. หากต้องช่วยเหลือ ส่งคำร้องพร้อมพิกัด, ประเภทความช่วยเหลือ, ภาพ/หมายเหตุ และระดับความเร่งด่วน
5. ระบบจับคู่ข้อมูลกับ flood polygon และทะเบียนกลุ่มเปราะบาง
6. ถ้าเข้าเงื่อนไขความเสี่ยงสูง ระบบแจ้ง EOC/EMS
7. อสม. เห็นสถานะงาน เช่น รับเรื่องแล้ว, กำลังเดินทาง, ถึงจุดเกิดเหตุ, ส่งต่อ, ปิดเคส

ต้องรองรับ offline-tolerant ตาม SRS:

- บันทึกข้อมูลได้เมื่อสัญญาณอ่อน
- sync ย้อนหลังเมื่อกลับมาออนไลน์
- ระบุเวลาจริงของการเก็บข้อมูล ไม่ใช่เฉพาะเวลาที่ sync

### 3. Shelter Health Management

SRS ระบุศูนย์พักพิงพร้อม capacity และจำนวนผู้พักพิงแบบ real-time โดย health-first phase ควรขยายให้ศูนย์พักพิงเป็นจุดดูแลสุขภาพด้วย

ข้อมูลศูนย์พักพิงขั้นต่ำ:

- ชื่อศูนย์พักพิง
- ประเภท: shelter, assembly point, clinic, hospital, temporary health post
- พิกัด
- capacity รวม
- occupancy ปัจจุบัน
- capacity สำหรับกลุ่มเปราะบาง เช่น wheelchair access, bedridden area, oxygen/electricity support
- ผู้รับผิดชอบและช่องทางติดต่อ
- สถานะพร้อมใช้งาน: open, near capacity, full, closed, unsafe
- รายการทรัพยากรสาธารณสุข: ยาพื้นฐาน, เตียง, oxygen, first-aid, clean water, sanitation

ใน repo ปัจจุบันมีฐานที่เกี่ยวข้องแล้ว:

- `infrastructures` ใน `src/db/schema.ts`
- `Infrastructure` และ `InfraType` ใน `src/types/index.ts`
- `InfraPanel` แสดง hospital, clinic, shelter, assembly
- `RoutesPanel` คำนวณเส้นทางจากกลุ่มเสี่ยงไปยัง shelter/assembly

สิ่งที่ควรต่อยอด:

- เพิ่ม occupancy real-time แยกจาก static capacity
- เพิ่ม health readiness ของศูนย์พักพิง
- เพิ่ม flow รับตัวผู้ป่วย/กลุ่มเปราะบางเข้าศูนย์พักพิง
- เพิ่มรายการผู้พักพิงที่ต้องติดตามต่อหลังเข้า shelter

## Functional Scope From SRS

SRS ระบุฟีเจอร์หลัก 7 รายการ:

| รหัส | ฟีเจอร์ | สถานะใน health-first phase |
| --- | --- | --- |
| FR-01 | Flood Map | ใช้เป็นฐานหลักในการประเมินพื้นที่เสี่ยง |
| FR-02 | GIS กลุ่มเปราะบาง | โฟกัสหลัก ต้องทำให้ทะเบียนและสถานะติดตามชัดเจน |
| FR-03 | Evacuation Point | ใช้เพื่อเชื่อมเส้นทางอพยพของกลุ่มเปราะบาง |
| FR-04 | ศูนย์พักพิง | โฟกัสหลัก โดยเพิ่มมิติ health readiness |
| FR-05 | Danger Point | ทำเท่าที่จำเป็นต่อความปลอดภัยในการเข้าถึงผู้ป่วย |
| FR-06 | Call for Help | โฟกัสผ่าน อสม./เจ้าหน้าที่พื้นที่ก่อน public channel |
| FR-07 | บริหารจัดการอาหาร | ยังไม่ใช่แกนหลัก แต่เชื่อมกับ shelter needs ได้ภายหลัง |

## Important Workflows

### Vulnerable Person Risk Review

1. ระบบ ingest หรือแสดง flood polygon / flood point ล่าสุด
2. ระบบคำนวณสถานะของกลุ่มเปราะบางจากพิกัดบ้าน
3. รายชื่อแสดงลำดับ `flood` ก่อน `near` ก่อน `safe`
4. เจ้าหน้าที่เลือกคนเพื่อดูรายละเอียด
5. ระบบแสดงข้อมูลที่จำเป็นต่อการตัดสินใจ เช่น ภาวะ, อุปกรณ์, caregiver, shelter ที่ใกล้ที่สุด
6. ทุกครั้งที่ดูข้อมูลส่วนบุคคลต้องบันทึก audit log

### VHV Help Request

1. อสม. ส่งคำร้องพร้อม GPS และประเภทความช่วยเหลือ
2. ระบบตรวจว่าคำร้องเกี่ยวกับบุคคลในทะเบียนหรือไม่
3. หากเป็นกลุ่ม medical priority สูงและอยู่ใน flood/near zone ให้ยกระดับเป็น HIGH
4. EOC/EMS เห็นคำร้องบน queue
5. มอบหมายกู้ภัย/EMS หรือส่งต่อศูนย์พักพิง
6. ผู้รับงานอัปเดต ETA และสถานะ
7. อสม. เห็นสถานะตอบกลับ
8. ปิดเคสพร้อม log สำหรับ After Action Review

### Shelter Assignment

1. เลือกผู้ป่วย/กลุ่มเปราะบางที่ต้องเคลื่อนย้าย
2. ระบบเสนอ shelter/assembly ที่ใกล้และยังมี capacity
3. ตรวจเงื่อนไขสุขภาพ เช่น ต้องใช้ไฟฟ้า, oxygen, wheelchair, caregiver
4. ยืนยันการส่งตัว
5. อัปเดต occupancy และสถานะผู้ป่วย
6. บันทึก timeline และผู้ดำเนินการ

## Non-functional Requirements

จาก SRS:

- Real-time update สำหรับศูนย์พักพิง, คำร้องขอความช่วยเหลือ, จุดอันตราย ภายใน 1 นาที
- Availability อย่างน้อย 99.5% ช่วงเกิดภัย
- Responsive Web ใช้งานได้บน mobile, tablet, desktop
- Role-based access ตามบทบาทผู้ใช้
- PDPA compliance โดยเฉพาะข้อมูลกลุ่มเปราะบาง
- Offline-tolerant สำหรับพื้นที่สัญญาณอ่อน

ข้อควรยึดใน implementation:

- ข้อมูล identity ของผู้ป่วยต้อง masked by default เมื่อไม่จำเป็น
- การเปิดดู/แก้ไขข้อมูลส่วนบุคคลต้องมี audit log
- mobile flow ของ อสม. ต้องเร็วและกรอกน้อยที่สุด
- dashboard ของ EOC ต้องเน้น triage และ action queue ไม่ใช่รายงานยาว
- ใช้ shadcn/ui primitives ตาม `AGENTS.md` โดยเฉพาะ dialog, sheet, popover, select, toast, tooltip, command

## Suggested Data Model Additions

ตารางที่อาจต้องเพิ่มเมื่อเริ่ม implement health-first workflow:

- `health_visits`: บันทึกการตรวจเยี่ยมของ อสม.
- `help_requests`: คำร้องขอความช่วยเหลือ
- `case_assignments`: การมอบหมายงานให้ EMS/กู้ภัย/เจ้าหน้าที่
- `shelter_status_snapshots`: capacity/occupancy แบบ time-series
- `shelter_admissions`: การรับตัวผู้ป่วยหรือกลุ่มเปราะบางเข้าศูนย์พักพิง
- `medical_priorities`: เกณฑ์หรือ override priority ของผู้ป่วย
- `sync_outbox`: queue สำหรับ offline submission จาก mobile

ฟิลด์สำคัญที่ควรมีในหลายตาราง:

- `created_by`, `assigned_to`, `updated_by`
- `observed_at` สำหรับเวลาที่เก็บข้อมูลจริง
- `synced_at` สำหรับเวลาที่ข้อมูลถึง server
- `source` เช่น VHV, EOC, EMS, import, sensor
- `status`
- `lat`, `lng`
- `audit_reason` เมื่อเข้าถึงข้อมูลส่วนบุคคล

## Implementation Notes For This Repo

ให้มอง repo ปัจจุบันเป็น MVP ของ command-center flood map ที่กำลังจะเพิ่ม health operations:

- UI shell เดิมเป็น map-first และมี rail/panel pattern อยู่แล้ว
- ข้อมูล vulnerable และ infrastructure มีอยู่แล้วแต่ยังเป็น demo/static shape บางส่วน
- schema ใช้ Drizzle/Postgres และมี audit log แล้ว
- ประเภท role ปัจจุบันใน code ยังเป็น `admin | officer | viewer` แต่ SRS มี role ละเอียดกว่า ควรออกแบบ mapping หรือ role expansion ก่อนเพิ่ม permission จำนวนมาก
- หลีกเลี่ยงการสร้าง modal/dropdown/select/toast เอง ใช้ `@/components/ui/*` ตามคำสั่งโปรเจค
- ฟอร์มและ detail view ควรใช้ Sheet/Popover/Dialog จาก shadcn/ui ไม่ใช้ custom primitive

## Open Questions

ประเด็นที่ SRS ระบุว่ายังต้องยืนยัน และมีผลกับ health-first scope:

- แหล่งข้อมูล GIS กลุ่มเปราะบางจะมาจากฐาน อสม., รพ.สต., หรือฐานกลางกระทรวงสาธารณสุข
- เกณฑ์ medical priority A/B/C คืออะไร และใครมีสิทธิ์ override
- ขอบเขต role ของ อสม. เขียน/แก้ไขข้อมูลได้ถึงระดับใด
- ศูนย์พักพิงต้องเก็บข้อมูลผู้พักพิงรายบุคคลหรือเฉพาะ aggregate
- food/water logistics จะผูกกับ shelter module ตั้งแต่แรกหรือเลื่อนไป phase หลัง
- ต้องรองรับพื้นที่ระดับตำบล อำเภอ หรือทั้งจังหวัดใน v1
- real-time จะใช้ polling, WebSocket, SSE หรือ sync batch จาก mobile

## Near-term Build Order

ลำดับงานที่แนะนำ:

1. ปรับ domain type และ schema สำหรับ vulnerable follow-up status
2. เพิ่ม visit/help request workflow สำหรับ อสม.
3. เพิ่ม shelter occupancy และ health readiness
4. เพิ่ม EOC triage queue สำหรับคำร้องที่ priority สูง
5. เพิ่ม audit log ให้ครอบคลุมการเปิดดูข้อมูลส่วนบุคคลจริง
6. เพิ่ม offline outbox สำหรับ mobile field updates
7. ค่อยขยาย danger point, food logistics และ public call-for-help
