# Vulnerable Groups Dataset — Data Dictionary & Queries

ระบบปักหมุดกลุ่มเปราะบาง (Vulnerable Persons Map Pins) ดึงข้อมูลจาก 2 แหล่ง:

1. **JHCIS** — ฐานข้อมูลสุขภาพชุมชน (MySQL) แหล่งข้อมูลหลักสำหรับปักหมุด
2. **App DB** — PostgreSQL ของระบบนี้ สำหรับสถานะติดตาม, การเยี่ยมบ้าน, และคำขอช่วยเหลือ

---

## 1. ตารางต้นทาง JHCIS (MySQL)

### `person` — ประชากรทะเบียนบ้าน

| คอลัมน์        | ประเภท       | คำอธิบาย                                              |
|----------------|--------------|-------------------------------------------------------|
| `pid`          | INT PK       | รหัสประชาชน (ใช้เป็น ID หลัก)                        |
| `pcucodeperson`| VARCHAR      | รหัส PCU ที่ลงทะเบียน                                |
| `hcode`        | INT          | รหัสบ้าน (FK → house.hcode)                          |
| `fname`        | VARCHAR      | ชื่อ                                                  |
| `lname`        | VARCHAR      | นามสกุล                                               |
| `prename`      | VARCHAR      | คำนำหน้า                                              |
| `birth`        | DATE         | วันเกิด (ใช้คำนวณอายุด้วย `TIMESTAMPDIFF`)           |
| `sex`          | CHAR(1)      | เพศ: `1` = ชาย, `2` = หญิง                           |
| `familyposition` | VARCHAR    | รหัสตำแหน่งในครอบครัว (FK → cfamilyposition)        |
| `father`       | VARCHAR      | ชื่อบิดา                                              |
| `mother`       | VARCHAR      | ชื่อมารดา                                             |
| `mate`         | VARCHAR      | ชื่อคู่สมรส                                           |
| `dischargetype`| VARCHAR      | สถานะ: `9` = มีชีวิตอยู่/ยังอาศัยในพื้นที่          |
| `typelive`     | VARCHAR      | ประเภทที่อยู่อาศัย: `1` = อาศัยปกติ, `3` = อาศัยชั่วคราว |

**เงื่อนไขกลุ่มเปราะบาง:**
- อายุ ≥ 60 ปี → ผู้สูงอายุ
- อายุ 0–5 ปี → เด็กเล็ก
- มีแถวใน `personunable` → ผู้พิการ/ทุพพลภาพ
- มีแถวใน `personchronic` → ผู้ป่วยโรคเรื้อรัง

---

### `house` — ข้อมูลบ้าน

| คอลัมน์   | ประเภท  | คำอธิบาย                                  |
|-----------|---------|-------------------------------------------|
| `hcode`   | INT PK  | รหัสบ้าน                                  |
| `pcucode` | VARCHAR | รหัส PCU ที่บ้านขึ้นทะเบียน              |
| `hno`     | VARCHAR | เลขที่บ้าน                                |
| `villcode`| VARCHAR | รหัสหมู่บ้าน 8 หลัก (FK → village)       |
| `pid`     | INT     | pid ของหัวหน้าครัวเรือน (FK → person)   |
| `xgis`    | DECIMAL | ละติจูด (Latitude) — ใช้ปักหมุดแผนที่   |
| `ygis`    | DECIMAL | ลองจิจูด (Longitude) — ใช้ปักหมุดแผนที่ |

> **หมายเหตุ:** แถวที่ `xgis` หรือ `ygis` เป็น NULL หรือว่างจะถูกกรองออก ไม่ปรากฏบนแผนที่

---

### `village` — ตารางหมู่บ้าน

| คอลัมน์    | ประเภท  | คำอธิบาย                      |
|------------|---------|-------------------------------|
| `pcucode`  | VARCHAR | รหัส PCU                      |
| `villcode` | VARCHAR | รหัสหมู่บ้าน 8 หลัก           |
| `villname` | VARCHAR | ชื่อหมู่บ้าน                  |
| `villno`   | INT     | หมายเลขหมู่ที่ (ม.X)         |

---

### `personunable` — ผู้พิการ/ทุพพลภาพ

| คอลัมน์        | ประเภท  | คำอธิบาย                        |
|----------------|---------|----------------------------------|
| `pcucodeperson`| VARCHAR | รหัส PCU                         |
| `pid`          | INT     | รหัสประชาชน (FK → person.pid)   |

> การมีแถวใน `personunable` = บุคคลนั้นถูกจัดเป็น **ผู้พิการ/ทุพพลภาพ**

---

### `personchronic` — ผู้ป่วยโรคเรื้อรัง

| คอลัมน์        | ประเภท  | คำอธิบาย                        |
|----------------|---------|----------------------------------|
| `pcucodeperson`| VARCHAR | รหัส PCU                         |
| `pid`          | INT     | รหัสประชาชน (FK → person.pid)   |

> การมีแถวใน `personchronic` = บุคคลนั้นถูกจัดเป็น **ผู้ป่วยโรคเรื้อรัง**

---

### `csubdistrict` / `cdistrict` — ตารางรหัสภูมิศาสตร์

| ตาราง         | คอลัมน์       | คำอธิบาย                                     |
|---------------|---------------|----------------------------------------------|
| `csubdistrict`| `subdistname` | ชื่อตำบล — join ผ่าน provcode+distcode+subdistcode |
| `cdistrict`   | `distname`    | ชื่ออำเภอ — join ผ่าน provcode+distcode      |

รหัสภูมิศาสตร์ decode จาก `house.villcode` (8 หลัก):
- หลักที่ 1–2: `provcode` (จังหวัด)
- หลักที่ 3–4: `distcode` (อำเภอ)
- หลักที่ 5–6: `subdistcode` (ตำบล)

---

### `cfamilyposition` — ตำแหน่งในครอบครัว

| คอลัมน์     | ประเภท  | คำอธิบาย                        |
|-------------|---------|----------------------------------|
| `famposcode`| VARCHAR | รหัสตำแหน่ง (FK → person.familyposition) |
| `famposname`| VARCHAR | ชื่อตำแหน่ง เช่น บิดา, มารดา, บุตร |

---

## 2. Output ที่ระบบส่งให้แผนที่ (`VulnerablePerson`)

ผลลัพธ์จาก `GET /api/vulnerable` ที่ใช้ปักหมุดบนแผนที่:

| Field           | Type                                      | คำอธิบาย                                         |
|-----------------|-------------------------------------------|---------------------------------------------------|
| `id`            | number                                    | pid จาก JHCIS                                    |
| `name`          | string                                    | ชื่อ-นามสกุล (prename + fname + lname)            |
| `type`          | `elderly` \| `disabled` \| `bedridden`   | ประเภทกลุ่มเปราะบาง (enum ภาษาอังกฤษ)            |
| `label`         | string                                    | ป้ายกำกับภาษาไทย เช่น "ผู้สูงอายุ", "ผู้พิการ/ทุพพลภาพ" |
| `age`           | number                                    | อายุ (ปี)                                         |
| `cond`          | string                                    | ภาวะ/เงื่อนไข (ใช้ label เดียวกัน)               |
| `vil`           | string                                    | เลขที่บ้าน + หมู่ที่                              |
| `tambon`        | string?                                   | ชื่อตำบล                                          |
| `amphoe`        | string?                                   | ชื่ออำเภอ                                         |
| `fullAddress`   | string?                                   | ที่อยู่เต็ม                                       |
| `lat`           | number                                    | ละติจูด (จาก `house.xgis`)                       |
| `lng`           | number                                    | ลองจิจูด (จาก `house.ygis`)                      |
| `risk`          | `flood` \| `near` \| `safe`              | ระดับความเสี่ยงน้ำท่วม (คำนวณจาก flood-points.json) |
| `floodLevel`    | 1–5 \| null                               | ระดับน้ำท่วม CMU KML ที่บ้านอยู่ในพื้นที่       |
| `medicalPriority` | `A` \| `B` \| `C`                      | ลำดับความเร่งด่วนทางการแพทย์                     |
| `followUpStatus`  | pending \| contacted \| needs_help \| moved \| referred \| closed | สถานะการติดตาม |

---

## 3. Output สำหรับ Family Folder (`VulnerableHousehold`)

ผลลัพธ์จาก `GET /api/family-folder` ที่ใช้ใน admin panel:

### ระดับครัวเรือน (`VulnerableHousehold`)

| Field             | Type                  | คำอธิบาย                         |
|-------------------|-----------------------|----------------------------------|
| `hcode`           | number                | รหัสบ้าน                         |
| `hno`             | string                | เลขที่บ้าน                       |
| `village`         | string                | ชื่อหมู่บ้าน                     |
| `villno`          | string                | หมู่ที่                           |
| `lat`             | number?               | ละติจูด                           |
| `lng`             | number?               | ลองจิจูด                          |
| `members`         | HouseholdMember[]     | รายชื่อสมาชิกในครัวเรือน         |
| `vulnerableCount` | number                | จำนวนสมาชิกที่เป็นกลุ่มเปราะบาง |

### ระดับสมาชิก (`HouseholdMember`)

| Field      | Type                                                              | คำอธิบาย              |
|------------|-------------------------------------------------------------------|-----------------------|
| `pid`      | number                                                            | รหัสประชาชน           |
| `name`     | string                                                            | ชื่อ-นามสกุล          |
| `age`      | number                                                            | อายุ                  |
| `sex`      | `ชาย` \| `หญิง` \| `-`                                           | เพศ                   |
| `position` | string                                                            | ตำแหน่งในครอบครัว     |
| `group`    | `ผู้สูงอายุ` \| `เด็กเล็ก` \| `ผู้พิการ` \| `โรคเรื้อรัง` \| `ทั่วไป` | กลุ่ม         |
| `isHead`   | boolean                                                           | เป็นหัวหน้าครัวเรือน |
| `father`   | string?                                                           | ชื่อบิดา              |
| `mother`   | string?                                                           | ชื่อมารดา             |
| `mate`     | string?                                                           | ชื่อคู่สมรส           |

---

## 4. ตาราง App DB (PostgreSQL) — สำหรับติดตามสถานะ

### `vulnerable_persons` — ข้อมูลกลุ่มเปราะบาง (persistent store)

| คอลัมน์            | ประเภท      | คำอธิบาย                                             |
|--------------------|-------------|------------------------------------------------------|
| `id`               | UUID PK     | รหัสในระบบนี้                                        |
| `name`             | TEXT        | ชื่อ-นามสกุล                                         |
| `type`             | TEXT        | `bedridden` \| `elderly` \| `disabled` \| `pregnant` |
| `label`            | TEXT        | ป้ายภาษาไทย                                          |
| `age`              | SMALLINT    | อายุ                                                  |
| `cond`             | TEXT        | ภาวะ/เงื่อนไขทางสุขภาพ                              |
| `equipment`        | TEXT        | อุปกรณ์การแพทย์ที่ต้องใช้                           |
| `village`          | TEXT        | ชื่อหมู่บ้าน                                         |
| `tambon`           | TEXT        | ตำบล                                                 |
| `amphoe`           | TEXT        | อำเภอ                                                |
| `lat`              | DECIMAL     | ละติจูด                                               |
| `lng`              | DECIMAL     | ลองจิจูด                                              |
| `caregiverPhone`   | TEXT        | เบอร์โทรผู้ดูแล                                     |
| `careUnit`         | TEXT        | รพ.สต./หน่วยบริการประจำ                             |
| `assignedVhvId`    | UUID        | อสม. ที่รับผิดชอบ (FK → users)                     |
| `medicalPriority`  | TEXT        | `A` \| `B` \| `C`                                   |
| `followUpStatus`   | TEXT        | `pending` \| `contacted` \| `needs_help` \| `moved` \| `referred` \| `closed` |
| `lastContactedAt`  | TIMESTAMP   | วันเวลาที่ติดต่อล่าสุด                              |
| `lastVisitedAt`    | TIMESTAMP   | วันเวลาที่เยี่ยมบ้านล่าสุด                          |
| `lastKnownStatus`  | TEXT        | สถานะล่าสุดที่ทราบ                                  |
| `consent`          | BOOLEAN     | ได้รับความยินยอม PDPA                               |

---

## 5. SQL Queries ที่ใช้

### Query 1: ปักหมุดแผนที่ (`GET /api/vulnerable`)
> ไฟล์: [src/app/api/vulnerable/route.ts](../src/app/api/vulnerable/route.ts)

ดึงบุคคลที่มีพิกัด GPS และเข้าเกณฑ์กลุ่มเปราะบาง พร้อม label ภาษาไทย:

```sql
SELECT
  p.pid AS id,
  CONCAT(p.fname, ' ', p.lname) AS name,
  TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) AS age,
  IFNULL(h.hno, '-') AS house_number,
  IF(v.villno != 0 AND v.villno IS NOT NULL, v.villno, '') AS moo,
  sd.subdistname AS tambon,
  d.distname AS amphoe,
  CONCAT(
    IFNULL(h.hno, '-'),
    IF(v.villno != 0 AND v.villno IS NOT NULL, CONCAT(' ม.', v.villno), ''),
    IFNULL(CONCAT(' ต.', sd.subdistname), ''),
    IFNULL(CONCAT(' อ.', d.distname), '')
  ) AS full_address,
  h.xgis AS lat,
  h.ygis AS lng,
  CASE
    WHEN MAX(u.pid) IS NOT NULL THEN 'disabled'
    WHEN MAX(c.pid) IS NOT NULL THEN 'bedridden'
    WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60 THEN 'elderly'
    ELSE 'elderly'
  END AS type,
  CASE
    WHEN MAX(u.pid) IS NOT NULL THEN 'ผู้พิการ/ทุพพลภาพ'
    WHEN MAX(c.pid) IS NOT NULL THEN 'ผู้ป่วยโรคเรื้อรัง'
    WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60 THEN 'ผู้สูงอายุ'
    ELSE 'กลุ่มเปราะบางอื่นๆ'
  END AS label
FROM person p
INNER JOIN house h
  ON p.hcode = h.hcode AND p.pcucodeperson = h.pcucode
LEFT JOIN village v
  ON h.pcucode = v.pcucode AND h.villcode = v.villcode
LEFT JOIN csubdistrict sd
  ON SUBSTRING(h.villcode, 1, 2) = sd.provcode
  AND SUBSTRING(h.villcode, 3, 2) = sd.distcode
  AND SUBSTRING(h.villcode, 5, 2) = sd.subdistcode
LEFT JOIN cdistrict d
  ON SUBSTRING(h.villcode, 1, 2) = d.provcode
  AND SUBSTRING(h.villcode, 3, 2) = d.distcode
LEFT JOIN personunable u
  ON p.pid = u.pid AND p.pcucodeperson = u.pcucodeperson
LEFT JOIN personchronic c
  ON p.pid = c.pid AND p.pcucodeperson = c.pcucodeperson
WHERE (h.xgis IS NOT NULL AND h.xgis != '')
  AND (h.ygis IS NOT NULL AND h.ygis != '')
  AND p.dischargetype = '9'           -- มีชีวิตอยู่ในทะเบียน
  AND p.typelive IN ('1', '3')        -- อาศัยปกติหรือชั่วคราว
  AND (
    TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60   -- ผู้สูงอายุ
    OR u.pid IS NOT NULL                             -- ผู้พิการ
    OR c.pid IS NOT NULL                             -- โรคเรื้อรัง
  )
GROUP BY p.pid
```

---

### Query 2: สรุปรายหมู่บ้าน (`getFamilyFolderSummary`)
> ไฟล์: [src/lib/family-folder.ts](../src/lib/family-folder.ts)

นับจำนวนครัวเรือนและกลุ่มเปราะบางแยกตามหมู่บ้าน:

```sql
SELECT
  h.villcode AS vcode,
  IFNULL(v.villname, '-') AS vname,
  IF(v.villno != 0 AND v.villno IS NOT NULL, CAST(v.villno AS CHAR), '') AS villno,
  COUNT(DISTINCT p.hcode) AS totalHouses,
  COUNT(DISTINCT CASE
    WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60
      OR TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) BETWEEN 0 AND 5
      OR pu.pid IS NOT NULL
      OR pc.pid IS NOT NULL
    THEN p.hcode END
  ) AS vulnerableHouses,
  COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60 THEN p.pid END) AS elderly,
  COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) BETWEEN 0 AND 5 THEN p.pid END) AS children,
  COUNT(DISTINCT CASE WHEN pu.pid IS NOT NULL THEN p.pid END) AS disabled,
  COUNT(DISTINCT CASE WHEN pc.pid IS NOT NULL THEN p.pid END) AS chronic
FROM person p
JOIN house h ON p.pcucodeperson = h.pcucode AND p.hcode = h.hcode
LEFT JOIN village v ON h.pcucode = v.pcucode AND h.villcode = v.villcode
LEFT JOIN personunable pu ON p.pcucodeperson = pu.pcucodeperson AND p.pid = pu.pid
LEFT JOIN (SELECT DISTINCT pcucodeperson, pid FROM personchronic) pc
  ON p.pcucodeperson = pc.pcucodeperson AND p.pid = pc.pid
WHERE (p.dischargetype IS NULL OR p.dischargetype = '9')
GROUP BY h.villcode, v.villname, v.villno
ORDER BY v.villno ASC
```

---

### Query 3: ดึงครัวเรือนกลุ่มเปราะบาง (paginated)
> ไฟล์: [src/lib/family-folder.ts](../src/lib/family-folder.ts)

**Step 1** — หา hcode ที่มีสมาชิกกลุ่มเปราะบาง:

```sql
SELECT DISTINCT p.hcode
FROM person p
LEFT JOIN personunable pu ON p.pcucodeperson = pu.pcucodeperson AND p.pid = pu.pid
JOIN house h ON p.pcucodeperson = h.pcucode AND p.hcode = h.hcode
WHERE (p.dischargetype IS NULL OR p.dischargetype = '9')
  AND (
    TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) >= 60
    OR TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) BETWEEN 0 AND 5
    OR pu.pid IS NOT NULL
    OR p.pid IN (SELECT pid FROM personchronic)
  )
  -- AND h.villcode = ?  (optional filter)
ORDER BY p.hcode
LIMIT ? OFFSET ?
```

**Step 2** — ดึงสมาชิกทุกคนในบ้านที่พบ:

```sql
SELECT
  p.hcode, p.pid,
  CONCAT(IFNULL(p.prename,''), p.fname, ' ', p.lname) AS name,
  TIMESTAMPDIFF(YEAR, p.birth, CURDATE()) AS age,
  p.sex, p.familyposition,
  fp.famposname,
  h.pid AS head_pid,
  h.hno, h.xgis AS lat, h.ygis AS lng,
  IF(v.villno != 0 AND v.villno IS NOT NULL, CAST(v.villno AS CHAR), '') AS villno,
  IFNULL(v.villname, '-') AS vname,
  IFNULL(p.father, '') AS father,
  IFNULL(p.mother, '') AS mother,
  IFNULL(p.mate, '') AS mate,
  IF(pu.pid IS NOT NULL, 1, 0) AS is_disabled,
  IF(pc.pid IS NOT NULL, 1, 0) AS is_chronic
FROM person p
JOIN house h ON p.pcucodeperson = h.pcucode AND p.hcode = h.hcode
LEFT JOIN village v ON h.pcucode = v.pcucode AND h.villcode = v.villcode
LEFT JOIN cfamilyposition fp ON p.familyposition = fp.famposcode
LEFT JOIN personunable pu ON p.pcucodeperson = pu.pcucodeperson AND p.pid = pu.pid
LEFT JOIN (SELECT DISTINCT pcucodeperson, pid FROM personchronic) pc
  ON p.pcucodeperson = pc.pcucodeperson AND p.pid = pc.pid
WHERE (p.dischargetype IS NULL OR p.dischargetype = '9')
  AND p.hcode IN (/* hcodes from step 1 */)
ORDER BY p.hcode, IF(h.pid = p.pid, 0, 1), p.birth ASC
```

---

## 6. เกณฑ์การจัดกลุ่มเปราะบาง

| กลุ่ม              | เกณฑ์                                              | type (EN)   |
|--------------------|----------------------------------------------------|-------------|
| ผู้สูงอายุ         | อายุ ≥ 60 ปี                                      | `elderly`   |
| เด็กเล็ก           | อายุ 0–5 ปี (ใช้เฉพาะ Family Folder)             | —           |
| ผู้พิการ/ทุพพลภาพ | มีแถวใน `personunable`                             | `disabled`  |
| ผู้ป่วยโรคเรื้อรัง | มีแถวใน `personchronic`                           | `bedridden` |

**ลำดับความสำคัญ** (กรณีเข้าเกณฑ์หลายข้อ): ผู้พิการ > โรคเรื้อรัง > ผู้สูงอายุ

---

## 7. API Endpoints

| Endpoint                | Method | Auth     | คำอธิบาย                                              |
|-------------------------|--------|----------|-------------------------------------------------------|
| `/api/vulnerable`       | GET    | optional | ปักหมุดแผนที่ + ความเสี่ยงน้ำท่วม, กรอง bbox ได้    |
| `/api/family-folder`    | GET    | required | ข้อมูลสมุดครอบครัว, กรอง villcode, paginate ได้      |

**Query parameters ของ `/api/vulnerable`:**
- `bbox=minLng,minLat,maxLng,maxLat` — กรองพื้นที่ที่แสดงบนแผนที่

**Query parameters ของ `/api/family-folder`:**
- `villcode=<8-digit>` — กรองตามหมู่บ้าน
- `page=<n>` — หน้า (default: 1)
- `limit=<n>` — จำนวนต่อหน้า (max: 200, default: 50)
