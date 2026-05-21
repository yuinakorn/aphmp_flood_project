import pool from '@/lib/jhcis-db'

export interface HouseholdMember {
  pid: number
  name: string
  age: number
  sex: 'ชาย' | 'หญิง' | '-'
  position: string
  group: 'ผู้สูงอายุ' | 'เด็กเล็ก' | 'ผู้พิการ' | 'โรคเรื้อรัง' | 'ทั่วไป'
  isHead: boolean
  father?: string
  mother?: string
  mate?: string
}

export interface VulnerableHousehold {
  hcode: number
  hno: string
  village: string
  villno: string
  lat?: number
  lng?: number
  members: HouseholdMember[]
  vulnerableCount: number
}

export interface VillageSummary {
  vcode: string
  vname: string
  villno: string
  totalHouses: number
  vulnerableHouses: number
  elderly: number
  children: number
  disabled: number
  chronic: number
}

export async function getFamilyFolderSummary(): Promise<VillageSummary[]> {
  const [rows] = await pool.query(`
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
  `)
  return rows as VillageSummary[]
}

export async function getFamilyFolderHouseholds(
  limit = 200,
  offset = 0,
  villcode?: string,
): Promise<{ households: VulnerableHousehold[]; total: number }> {
  const villFilter = villcode ? `AND h.villcode = ?` : ''
  const villParams = villcode ? [villcode] : []

  const [hcodeRows] = await pool.query(
    `SELECT DISTINCT p.hcode
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
       ${villFilter}
     ORDER BY p.hcode
     LIMIT ? OFFSET ?`,
    [...villParams, limit, offset],
  )

  const hcodes = hcodeRows as { hcode: number }[]
  if (hcodes.length === 0) return { households: [], total: 0 }

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT p.hcode) as total
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
       ${villFilter}`,
    villParams,
  )
  const total = (countRows as { total: number }[])[0]?.total ?? 0

  const hcodeList = hcodes.map((r) => r.hcode)
  const placeholders = hcodeList.map(() => '?').join(',')

  const [memberRows] = await pool.query(
    `SELECT
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
       AND p.hcode IN (${placeholders})
     ORDER BY p.hcode, IF(h.pid = p.pid, 0, 1), p.birth ASC`,
    hcodeList,
  )

  type MemberRow = {
    hcode: number; pid: number; name: string; age: number; sex: string
    familyposition: string | null; famposname: string | null; head_pid: number | null
    hno: string | null; lat: string | null; lng: string | null
    villno: string; vname: string; father: string; mother: string; mate: string
    is_disabled: number; is_chronic: number
  }

  const rows = memberRows as MemberRow[]
  const householdMap = new Map<number, VulnerableHousehold>()

  for (const row of rows) {
    if (!householdMap.has(row.hcode)) {
      householdMap.set(row.hcode, {
        hcode: row.hcode,
        hno: row.hno ?? '-',
        village: row.vname,
        villno: row.villno,
        lat: row.lat ? parseFloat(row.lat) : undefined,
        lng: row.lng ? parseFloat(row.lng) : undefined,
        members: [],
        vulnerableCount: 0,
      })
    }

    const house = householdMap.get(row.hcode)!
    const age = Number(row.age) || 0
    const isHead = row.head_pid === row.pid

    let group: HouseholdMember['group'] = 'ทั่วไป'
    if (age >= 60) group = 'ผู้สูงอายุ'
    else if (age <= 5) group = 'เด็กเล็ก'
    else if (row.is_disabled) group = 'ผู้พิการ'
    else if (row.is_chronic) group = 'โรคเรื้อรัง'

    let position = 'สมาชิก'
    if (isHead) position = 'หัวหน้าครัวเรือน'
    else if (row.famposname) position = row.famposname

    const sexMap: Record<string, HouseholdMember['sex']> = { '1': 'ชาย', '2': 'หญิง' }

    house.members.push({
      pid: row.pid, name: row.name, age, sex: sexMap[row.sex] ?? '-',
      position, group, isHead,
      father: row.father || undefined,
      mother: row.mother || undefined,
      mate: row.mate || undefined,
    })

    if (group !== 'ทั่วไป') house.vulnerableCount++
  }

  return { households: Array.from(householdMap.values()), total }
}
