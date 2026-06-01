# AUTH-SPEC — ThaiD + ทะเบียนเจ้าหน้าที่ + Province scope

สถานะ: draft (2026-06-01) · เจ้าของ: yuinakorn

ระบบยืนยันตัวตน + ให้สิทธิ์ + ผูกทุกอย่างกับ "จังหวัดสังกัด" และ "เหตุการณ์"
แทนที่โครงเดิม (Provider ID SSO + demo credentials ที่ไม่มี scope)

---

## 1. หลักการ — แยก Authentication ออกจาก Authorization

ThaiD บอกได้แค่ "คุณคือใคร (CID)" — **ไม่รู้** จังหวัดสังกัด/ตำแหน่ง
ดังนั้นต้องมีทะเบียนเจ้าหน้าที่ของเราเอง (`users`) เป็นตัวกำหนดสิทธิ์

```
1. Authentication (ThaiD)        → ยืนยัน "คุณคือ CID = x-xxxx-xxxxx-xx-x"
2. Authorization (users table)   → "CID นี้ = role R, จังหวัด P, หน่วยงาน U, status active"
```

- **`users.cidHash` (เจ้าหน้าที่)** กับ **`householdMembers.nationalId` (กลุ่มเปราะบาง)**
  เป็นคนละชุดข้อมูล **ไม่ match กัน** — "เทียบกับ ThaiD" = เทียบ CID เจ้าหน้าที่ ↔ CID ที่ ThaiD ยืนยัน
- เก็บเฉพาะ **hash** ของ CID (SHA-256) ตาม PDPA — ไม่เก็บ raw

---

## 2. ตาราง `users` (ทะเบียนเจ้าหน้าที่)

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid pk | |
| `cidHash` | text unique, null ได้ | SHA-256 ของ CID 13 หลัก (PDPA — ไม่เก็บ raw) |
| `name` | text notNull | เติมจาก ThaiD ได้ |
| `role` | text notNull default `viewer` | admin / eoc / officer / vhv / ems / rescue / ddpm / shelter_manager / viewer |
| `province` | text, null ได้ | **กุญแจ scope ทั้งระบบ** |
| `unitCode` | text, null ได้ | รหัสหน่วยงาน/รพ.สต. |
| `unitName` | text, null ได้ | ชื่อหน่วยงาน |
| `status` | text notNull default `active` | `pending` / `active` / `suspended` |
| `registeredVia` | text notNull default `credentials` | `thaid` / `whitelist` / `credentials` |
| `approvedBy` | uuid, null ได้ | ผู้อนุมัติ (self-register) |
| `approvedAt` | timestamptz, null ได้ | |
| `email` | text unique, **null ได้** | คงไว้รองรับ flow shelter-staff เดิม |
| `passwordHash` | text, **null ได้** | ThaiD ไม่ต้องมี password |
| `createdAt` | timestamptz | |
| `lastLoginAt` | timestamptz, null ได้ | |

> ระดับ scope = **จังหวัดเท่านั้น** (ไม่ลงลึกถึง อำเภอ/ตำบล ในเฟสนี้)

---

## 3. State machine การลงทะเบียน (รองรับทั้ง 2 ทาง)

```
ThaiD ยืนยัน CID
      ↓
 ค้น cidHash ใน users
      ├─ พบ + active     → เข้าระบบ (อัปเดต lastLoginAt)
      ├─ พบ + pending    → หน้า "รออนุมัติ"
      ├─ พบ + suspended  → หน้า "ถูกระงับสิทธิ์"
      └─ ไม่พบ           → ฟอร์ม self-register (เลือกจังหวัด/หน่วยงาน)
                            → สร้าง row status=pending, registeredVia=thaid
                            → admin อนุมัติ → active
```

- **Whitelist:** admin สร้าง row ล่วงหน้า (`status=active`, ใส่ cidHash + จังหวัด + role, registeredVia=`whitelist`)
  → ThaiD login ครั้งแรก match ได้เข้าทันที
- **Self-register:** CID ไม่อยู่ในระบบ → กรอกเอง → รออนุมัติ

### หมายเหตุ — โหมดจำลอง ThaiD (เฟส 2)
ตอนนี้ "ThaiD" จำลองด้วย credentials provider `thaid-sim` ที่รับ CID ตรงๆ
(`src/lib/auth.ts`). เมื่อต่อ ThaiD จริง: แทน input CID ด้วย OAuth redirect ของ ThaiD
แล้วเรียก `resolveStaffByCid(cidFromThaiD)` เหมือนเดิม — logic authorization ไม่ต้องแก้

**จุดต่อ ThaiD จริง:** สร้าง `src/lib/thaid.ts` (OAuth provider โครงคล้าย `provider-id-sso.ts`)
→ ดึง CID จาก claim → ใน `signIn`/`profile` callback เรียก `resolveStaffByCid`

---

## 4. Province scope

แก้ `src/lib/incident-scope.ts`:

- `getSelectableIncidents(role, province)`
  - role ระดับชาติ (`admin`, `ddpm`) → เห็นทุกจังหวัด
  - อื่นๆ → `WHERE incidents.province = user.province`
- `getActiveIncident()` ต้อง **validate** ว่า incident ใน cookie อยู่ในจังหวัดของ user
  (กัน set cookie ข้ามจังหวัด) — ถ้าไม่ใช่ → ลบ cookie

---

## 5. Gate "บังคับเลือกเหตุการณ์" + เก็บโหมดปกติ

`INCIDENT_COOKIE` มี 3 สถานะ:

| ค่า | ความหมาย |
|---|---|
| (ไม่มีค่า) | ยังไม่เลือก → เด้งไปหน้าเลือก |
| `normal` | ทะเบียนปกติทั้งจังหวัด (ใช้ทั้งปี — ไม่ผูกเหตุการณ์) |
| `<uuid>` | เหตุการณ์นั้น (โหมดวิกฤต) |

- route ใหม่ `/admin/select-incident` — แสดงเหตุการณ์ในจังหวัด + การ์ด "ทะเบียนปกติทั้งจังหวัด"
- `admin/layout.tsx` เช็ก: cookie ว่าง และไม่ได้อยู่หน้าเลือก → redirect ไปเลือกก่อน

---

## 6. ลำดับเฟส

| เฟส | งาน | สถานะ |
|---|---|---|
| 1 | schema `users` + migration | ✅ เสร็จ (`0023_shallow_lilandra.sql`) |
| 2 | ThaiD (**จำลอง**) + resolve CID→users + หน้า self-register/รออนุมัติ | ✅ เสร็จ |
| 3 | province scope + จำกัด role สร้าง/จัดการเหตุการณ์ | ✅ เสร็จ |
| 4 | หน้า `/admin/select-incident` + gate (middleware) + sentinel `normal` | ✅ เสร็จ |
| 5 | หน้า admin จัดการเจ้าหน้าที่ (อนุมัติ / whitelist / ระงับ) | ✅ เสร็จ |
