# EOC KPI — Disposition Funnel (โหมดวิกฤต)

> สถานะ: **implement แล้ว (ทางเลือก A — derive สด)** 2026-06-02
> โค้ด: `src/lib/incident-disposition.ts` (helper) · `src/app/(admin)/admin/eoc/page.tsx` (derive+แนบ) · `EocDashboard.tsx` (`<DispositionFunnel>`)
> ที่มา: เทียบ ribbon ปัจจุบันกับ KPI การ์ดใน mockup (`heart_pototype/screenshot_5_31_2026_2-04-37 PM.png`)
> เป้าหมาย: เปลี่ยน KPI โหมดวิกฤตจาก "ตัวเลขคนละแกน" → "สถานะการกระจายตัวของคน (disposition funnel)" ที่บวกกันครบและบอกการตัดสินใจ

---

## 1. ปัญหาของ ribbon ปัจจุบัน

โหมดวิกฤต ([EocDashboard.tsx:315-323](../../src/app/(admin)/admin/eoc/EocDashboard.tsx)) แสดง 7 ตัวเลขที่อยู่คนละแกน:

| กลุ่มเปราะบาง | ในเขตน้ำท่วม | เฝ้าระวัง | เสียชีวิต | บาดเจ็บ | คำร้องเปิด | ทีมกู้ภัย |
|---|---|---|---|---|---|---|
| ประชากร | ความเสี่ยงตามพิกัด | ความเสี่ยง | ผู้บาดเจ็บ | ผู้บาดเจ็บ | workflow | ทรัพยากร |

- บวกกันไม่ได้ ไม่เล่าเรื่อง
- ไม่มีตัวไหนบอกว่า "ต้องทำอะไรต่อ" → เป็น *metrics* ไม่ใช่ *operational status*
- `ในเขตน้ำท่วม`/`เฝ้าระวัง` มาจาก `p.risk` (ความเสี่ยงตามพิกัด) — บอกว่า "ใครอยู่จุดเสี่ยง" แต่ไม่บอกว่า "ตอนนี้คนนั้นอยู่ไหน / ปลอดภัยหรือยัง"

## 2. KPI ชุดใหม่ — Disposition Funnel

คำถามที่ commander ต้องตอบทุก 30 นาที: **"คน N รายตอนนี้อยู่ไหน และเหลือใครที่ยังต้องไปเอา?"**

```
┌──────────┬────────────────┬─────────────┬───────────────┬──────────────┬───────────────┐
│ ทั้งหมด   │ ปลอดภัย/อพยพแล้ว │ ยังอยู่ในบ้าน │ กำลังเคลื่อนย้าย │ ส่งต่อ รพ.     │ ติดต่อไม่ได้    │
│          │       ✓        │      ⚠      │       →       │      ✚       │ (พื้นหลังเข้ม)  │
│    38    │      22        │      8      │       3       │      2       │      3        │
│ ในเหตุการณ์│  58% ของทั้งหมด │ ต้องช่วยเหลือ  │ ติดตามให้ถึง   │ รพ.ปลายทาง 2  │ ต้องส่งทีมเข้าพื้นที่│
└──────────┴────────────────┴─────────────┴───────────────┴──────────────┴───────────────┘
  neutral       safe(เขียว)      flood(แดง)      near(เหลือง)    signal-data(ฟ้า)  dark/urgent

  ── แถบรองใต้ funnel (casualties — คนละมิติ) ──
  เสียชีวิต 0 · บาดเจ็บ 1 · สูญหาย 0
```

> สัดส่วนตัวเลขเป็นภาพประกอบ — รวม disposition (22+8+3+2+3 = 38) = ทั้งหมดเสมอ; casualties เป็นแถบรองแยก เพราะคนที่เสีย/เจ็บก็ยังถูกนับใน bucket disposition (คนละแกน)

คุณสมบัติของแต่ละการ์ด:
- **ไอคอนสื่อสถานะ** (✓ / ⚠ / → / ✚ / ● เข้ม)
- **ตัวเลขใหญ่** เป็นจำนวนคนจริง
- **บรรทัดล่างตีความ** → แปลงตัวเลขเป็นการตัดสินใจ
- สี map กับ design system เดิม: `--risk-safe` / `--risk-flood` / `--risk-near` / `--signal-data`; การ์ด "ติดต่อไม่ได้" พื้นเข้มเพราะคือ **งานเร่งด่วนที่สุด**

### นิยาม 6 bucket disposition (mutually exclusive — คนหนึ่งอยู่ได้ bucket เดียว, รวม = ทั้งหมด)

| # | bucket | label | สี | บรรทัดล่าง | action ที่สื่อ |
|---|--------|-------|----|-----------|----------------|
| 1 | `total` | ทั้งหมด | neutral | "ในเหตุการณ์นี้" | baseline |
| 2 | `safe` | ปลอดภัย/อพยพแล้ว | safe | "N% ของทั้งหมด" | ไม่ต้องทำอะไร |
| 3 | `at_home` | ยังอยู่ในบ้าน | flood | "ต้องช่วยเหลือ N ราย" | watch list — ประเมินซ้ำ |
| 4 | `in_transit` | กำลังเคลื่อนย้าย | near | "ติดตามให้ถึงปลายทาง" | ติดตามให้ถึงศูนย์ |
| 5 | `referred` | ส่งต่อ รพ. | signal-data | "รพ.ปลายทาง N" | ติดตามกับ รพ. |
| 6 | `unreachable` | ติดต่อไม่ได้ / ยังไม่ประเมิน | dark | "ต้องส่งทีมเข้าพื้นที่" | **เร่งด่วนสุด** |

> **at_home = เฉพาะ `needs_help`** (เคาะแล้ว §6) — คนที่ยืนยันแล้วว่ายังอยู่ในเขตและ**ยังต้องช่วย** = watch list จริง. คนที่ปลอดภัยอยู่กับที่ (`safe`-in-place) ไปนับใน bucket `safe`
> **casualties (เสียชีวิต/บาดเจ็บ/สูญหาย) = แถบรองใต้ funnel** (เคาะแล้ว §6) — derive จาก `counters.casualties` เดิม, แสดงเป็น text strip บรรทัดเดียว ไม่ปนแกน disposition

## 3. Data backing — disposition มาจากไหน, ใครกรอก

นี่คือหัวใจ (ตามหลัก data-backed design): ทุก bucket ต้องมีคนกรอกจริงและมี graceful degradation

### 3.1 derive จากสัญญาณที่มีอยู่แล้ว (ไม่ต้องให้ใครกรอกเพิ่ม)

ทุก bucket คำนวณได้จากตารางที่มี input owner อยู่แล้ว:

| สัญญาณ | ตาราง | ผู้กรอกจริง |
|--------|-------|------------|
| เยี่ยม + สถานะคน | `health_visits.personStatus` (`safe`/`needs_help`/`evacuated`/`referred`/`unknown`) | อสม./จนท.ภาคสนาม |
| ติดต่อไม่ได้ | `health_visits.visitStatus = 'unreachable'` | อสม. |
| เข้าศูนย์พักพิง | `shelter_admissions.status = 'admitted'` | จนท.ศูนย์พักพิง |
| ส่งต่อ รพ. | `hospital_referrals.status ∈ {pending, accepted, en_route}` | จนท.ศูนย์/รพ. |
| คำร้องอพยพกำลังดำเนินการ | `help_requests` (type=`evacuation`, status ∈ {assigned, en_route}) | EOC |

### 3.2 ลำดับความสำคัญในการ derive (precedence — แก้กรณีสัญญาณขัดกัน)

คำนวณ disposition ของแต่ละคน "ภายใน scope เหตุการณ์" ตามลำดับนี้ (เจอข้อแรกที่ match ใช้เลย):

```
1. มี active hospital_referral (pending/accepted/en_route)        → referred  (bucket 6)
2. มี help_request evacuation ที่ assigned/en_route               → in_transit
3. มี active shelter_admission (admitted)                         → safe (อพยพแล้ว)
4. latest health_visit ภายในเหตุการณ์:
     personStatus = 'referred'                                    → referred
     personStatus = 'evacuated'                                   → safe
     personStatus = 'safe'                                        → safe (ปลอดภัยในที่)
     personStatus = 'needs_help'                                  → at_home
     visitStatus  = 'unreachable'                                 → unreachable
5. ไม่มี contact ใดๆ ภายในเหตุการณ์เลย                            → unreachable (ยังไม่ประเมิน)
```

> หมายเหตุ "safe" รวม 2 กรณี: อพยพไปศูนย์แล้ว + ปลอดภัยอยู่กับที่ (ยืนยันแล้ว). bucket "at_home" = เฉพาะ `needs_help` → คนที่ยืนยันแล้วว่ายังอยู่ในเขต **และยังต้องช่วย** = watch list จริง. "ส่งต่อ รพ." แยกออกจาก in_transit เป็น bucket `referred` ของตัวเอง เพราะปลายทางคนละชนิด (รพ. ไม่ใช่ศูนย์พักพิง) และติดตามคนละช่องทาง

### 3.3 graceful degradation

- **ยังไม่เปิดเหตุการณ์ (โหมดปกติ)** → ไม่แสดง funnel นี้ (คง ribbon coverage เดิม)
- **เปิดเหตุการณ์ใหม่ ยังไม่มีใครลงเยี่ยม** → ทุกคนตก bucket `unreachable` โดยอัตโนมัติ = "ยังไม่ประเมิน N ราย, ต้องส่งทีมเข้าพื้นที่" ← ซึ่งถูกต้องตามสถานการณ์จริงวันแรก
- ไม่มี personStatus (เก่า/null) → นับเป็น unreachable ปลอดภัยไว้ก่อน (ไม่หายไปจากยอด)

## 4. ทางเลือกการ implement

### ทางเลือก A — derive สดทุกครั้ง (แนะนำสำหรับเฟสแรก)
- เพิ่ม helper `lib/incident-disposition.ts` → รับ `incidentId` + รายชื่อ persons ในสโคป, query 3 ตาราง (visits/admissions/referrals) แล้ว reduce เป็น `Record<bucket, number>` + แนบ `disposition` ราย person
- **ไม่แตะสคีมา** — เร็วต่อการทำ, ไม่มี migration
- ข้อเสีย: ทุก render ต้อง join หลายตาราง (แต่สเกลผู้เปราะบางต่อเหตุการณ์อยู่หลักร้อย–พัน ยังไหว)

### ทางเลือก B — ตาราง read-model `incident_member_disposition` (ทำเมื่อสเกลโต / ต้อง manual override)
```sql
incident_member_disposition (
  incident_id  uuid  references incidents,
  member_id    uuid  references household_members,
  disposition  text,  -- safe | at_home | in_transit | unreachable
  source       text,  -- 'derived' | 'manual'   ← EOC แก้มือทับได้
  whereabouts  text,  -- shelter_id / hospital / 'home' / freeform
  updated_by   uuid,
  updated_at   timestamptz,
  primary key (incident_id, member_id)
)
```
- upsert อัตโนมัติจาก route ที่มีอยู่: save visit, admit shelter, create referral
- ได้ของแถม: **EOC แก้สถานะมือได้** (เช่น มาร์ค "ติดต่อไม่ได้" เมื่อโทรไม่ติด ก่อนส่งทีม), query เร็ว (1 ตาราง), ทำ trend/Sit Rep snapshot ได้

**คำแนะนำ:** เริ่ม A เพื่อเห็นผลเร็วและตรวจ business logic, แล้วค่อย materialize เป็น B เมื่อยืนยัน precedence ลงตัว

## 5. งานที่ต้องทำ (ถ้าไป A)

1. `src/types/index.ts` — เพิ่ม `export type IncidentDisposition = 'safe' | 'at_home' | 'in_transit' | 'referred' | 'unreachable'`; ขยาย `VulnerablePerson.disposition?` (optional)
2. `src/lib/incident-disposition.ts` — helper derive ตาม §3.2; export `summarize(persons, signals) → { total, safe, atHome, inTransit, referred, unreachable }` (casualties ใช้ `counters.casualties` เดิม ไม่อยู่ในนี้)
3. `page.tsx` — เมื่อ `scope` (โหมดวิกฤต) query visits/admissions/referrals ของ incident, เรียก helper, ส่ง `disposition` ลง persons + `dispositionSummary` ลง dashboard
4. `EocDashboard.tsx` — แทน `ribbon` โหมดวิกฤตด้วยคอมโพเนนต์ `<DispositionFunnel>` 6 การ์ด + casualties strip ใต้ funnel (โหมดปกติคง ribbon coverage เดิม)
5. (option) ใช้ `disposition` ระบายสีหมุดแผนที่ + เพิ่มฟิลเตอร์ "เหลือใครติดต่อไม่ได้"

## 6. ข้อสรุปที่เคาะแล้ว (2026-06-02)

- **bucket "at_home" = เฉพาะ `needs_help`** — watch list แคบ ตรงประเด็น; `safe`-in-place ไปนับใน `safe`
- **casualties (ตาย/บาดเจ็บ/สูญหาย) = แถบรองใต้ funnel** — derive จาก `counters.casualties` เดิม, text strip บรรทัดเดียว ไม่ปนแกน disposition
- **"ส่งต่อ รพ." = bucket `referred` แยกต่างหาก (ใบที่ 6)** — ไม่รวมใน in_transit เพราะปลายทาง/ช่องทางติดตามต่างกัน → funnel มี 6 ใบ
