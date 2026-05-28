# Phase 2: Field Workflow API — สถานะ

อัปเดตล่าสุด: 2026-05-28

---

## สิ่งที่ทำเสร็จแล้วใน session นี้

### 1. Architecture Decision: Own Table + Ingest API

เปลี่ยนจากการดึงข้อมูล JHCIS โดยตรง → ระบบเรามี `vulnerable_persons` เป็น system of record
แต่ละหน่วยบริการ (รพ.สต., อปท.) push ข้อมูลมาผ่าน `/api/ingest/vulnerable` พร้อม API key

**เหตุผล:** รองรับหลายจังหวัด, หลายระบบต้นทาง (JHCIS, HOSxP, กรอกมือ), offline-tolerant

### 2. Schema — `src/db/schema.ts`

เพิ่มใน `vulnerable_persons`:

| Field | Type | หมายเหตุ |
|---|---|---|
| `source_system` | text | `jhcis` / `hosxp` / `manual` / `import` |
| `source_unit` | text | pcucode ของหน่วยบริการต้นทาง |
| `source_id` | text | PID หรือ ID ในระบบต้นทาง |
| `source_synced_at` | timestamptz | เวลาที่หน่วยบริการ push ครั้งล่าสุด |
| `deleted_at` | timestamptz | soft delete |
| `province` | text | จังหวัด (เพิ่มจาก amphoe/tambon) |

Unique index: `(source_system, source_unit, source_id)` — ป้องกัน duplicate จากแหล่งเดิม
NULL ถือว่าไม่ conflict (standard Postgres) ดังนั้น manual entry หลายรายการได้

เพิ่มตารางใหม่ `unit_api_keys`:

| Field | หมายเหตุ |
|---|---|
| `key_hash` | SHA-256 ของ raw key — ไม่เก็บ plaintext |
| `unit_code` | pcucode หรือรหัสหน่วยบริการ |
| `unit_name` | ชื่อหน่วยบริการ |
| `province` | จังหวัด |
| `is_active` | ปิด/เปิด key ได้โดยไม่ต้องลบ |
| `last_used_at` | tracking การใช้งาน |

Migration: `src/db/migrations/0002_add_source_fields_and_unit_api_keys.sql`

### 3. `src/lib/unit-auth.ts` — ใหม่

Utility สำหรับ authenticate หน่วยบริการ:
- `extractBearerKey(header)` — parse `Authorization: Bearer <key>`
- `hashKey(rawKey)` — SHA-256
- `authenticateUnit(rawKey)` — lookup DB, คืน `AuthedUnit | null`, อัปเดต `last_used_at` แบบ fire-and-forget

### 4. `POST /api/ingest/vulnerable` — ใหม่

`src/app/api/ingest/vulnerable/route.ts`

- Auth: API key ต่อหน่วยบริการ
- รับ body: `{ persons: IngestPerson[], sourceSystem: string, deleteMissing?: boolean }`
- Batch สูงสุด 2,000 คนต่อ request
- Upsert ด้วย `(source_system, source_unit, source_id)` — อัปเดตถ้ามีอยู่แล้ว, สร้างใหม่ถ้าไม่มี
- `deleteMissing = true` (default): soft-delete record จากหน่วยนี้ที่ไม่อยู่ใน batch
- คืน `{ inserted, updated, deleted, errors, unit, syncedAt }`

### 5. `GET /api/vulnerable` — rewrite

`src/app/api/vulnerable/route.ts` — ดึงจาก `vulnerable_persons` (Postgres) แทน JHCIS

**PDPA mask:**
- `anonymous` / `viewer` → เห็นแค่ `type`, `tambon`, `amphoe`, `province`, `risk`, `followUpStatus`, `medicalPriority` + พิกัดปัดเศษ 2 ทศนิยม (~1km)
- `officer` / `admin` / `eoc` / `vhv` / `ems` / `ddpm` → เห็นข้อมูลเต็ม + บันทึก audit log

Filter: `bbox`, `status`, `priority`, `province`, `limit`
ไม่คืน soft-deleted records (`deleted_at IS NULL`)

**`POST /api/vulnerable`** — แก้จาก TODO stub ให้ insert จริง สำหรับ manual entry เดี่ยว

### 6. `GET /api/health-visits` — ใหม่

เพิ่มใน `src/app/api/health-visits/route.ts`

- Auth: officer+ เท่านั้น
- Params: `?personId=<uuid>&limit=<n>`
- คืนประวัติการเยี่ยมเรียงตาม `observed_at` DESC

---

## API Summary (Phase 2 complete)

| Method | Path | Auth | หน้าที่ |
|---|---|---|---|
| `GET` | `/api/field/tasks` | officer+ | รายการกลุ่มเปราะบางที่ต้องติดตาม เรียง risk/priority |
| `GET` | `/api/health-visits` | officer+ | ประวัติการเยี่ยม filter ด้วย personId |
| `POST` | `/api/health-visits` | officer+ | บันทึกผลเยี่ยมบ้าน อัปเดต followUpStatus |
| `GET` | `/api/help-requests` | eoc+ | คิวคำร้องขอความช่วยเหลือ |
| `POST` | `/api/help-requests` | officer+ | ส่งคำร้องพร้อมพิกัด + auto-escalate priority |
| `GET` | `/api/vulnerable` | public (masked) / officer+ (full) | รายการกลุ่มเปราะบาง + PDPA mask |
| `POST` | `/api/vulnerable` | officer+ | สร้าง record เดี่ยว (manual) |
| `POST` | `/api/ingest/vulnerable` | API key | Batch upsert จากหน่วยบริการภายนอก |

---

## สิ่งที่ยังค้างและต้องทำก่อน production

### ต้องทำก่อน deploy

- [ ] `npm run db:push` หรือ run migration `0002_add_source_fields_and_unit_api_keys.sql`
- [ ] สร้าง record แรกใน `unit_api_keys` ด้วยมือ (admin ออก key → `sha256(rawKey)` → insert)
- [ ] ลบ connection pool ไปยัง JHCIS (`src/lib/jhcis-db.ts`) ถ้าไม่ใช้งานแล้ว ป้องกัน connection leak

### ต้องมีก่อน Phase 3

- [x] `PATCH /api/vulnerable/[id]` — officer อัปเดต followUpStatus / careUnit / assignedVhvId / medicalPriority / lastKnownStatus / lastContactedAt
- [x] `GET /api/vulnerable/[id]` — ดูรายละเอียดคนเดียว พร้อม audit log + PDPA mask
- [x] `GET /api/health-visits?personId=` รองรับทั้ง UUID และ sourceId ของ JHCIS (ส่ง `?personId=<pid>&sourceSystem=jhcis`)

---

## Phase ถัดไป: Phase 3 — EOC Triage Queue

- หน้า `/admin/triage` แสดงคิว help requests เรียง priority/status
- Auto-escalate เมื่อคนในทะเบียน + อยู่ในพื้นที่ flood/near (logic มีแล้วใน POST help-requests)
- Assignment → EMS/กู้ภัย/ทีมพื้นที่ + status timeline
- Real-time polling หรือ SSE
