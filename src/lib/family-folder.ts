import { getDb } from '@/lib/db'
import { households, householdMembers } from '@/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'

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

// สมาชิกบ้านสำหรับ popup บนแผนที่ — มีเบอร์ + flag กลุ่มเปราะบาง
export interface HouseholdMapMember {
  name: string
  age: number
  sex: 'ชาย' | 'หญิง' | '-'
  position: string
  group: HouseholdMember['group']
  isHead: boolean
  isVulnerable: boolean
  phone: string | null
}

// หมุดบ้านบนแผนที่ — full data (masking ทำที่ route ตาม role)
export interface HouseholdMapMarker {
  id: string
  hno: string
  village: string
  villno: string
  tambon: string | null
  amphoe: string | null
  province: string | null
  lat: number
  lng: number
  vulnerableCount: number
  members: HouseholdMapMember[]
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

type MemberRow = typeof householdMembers.$inferSelect
type HouseRow = typeof households.$inferSelect

// uuid → เลข int แบบ stable (ใช้เป็น hcode/pid ให้เข้ากับ interface เดิมที่เป็น number)
function intFromUuid(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 7), 16)
}

function classifyGroup(
  age: number | null,
  isDisabled: boolean,
  isChronic: boolean,
): HouseholdMember['group'] {
  if (age != null && age >= 60) return 'ผู้สูงอายุ'
  if (age != null && age <= 5) return 'เด็กเล็ก'
  if (isDisabled) return 'ผู้พิการ'
  if (isChronic) return 'โรคเรื้อรัง'
  return 'ทั่วไป'
}

function toMember(m: MemberRow): HouseholdMember {
  const age = m.age ?? 0
  const group = classifyGroup(m.age, m.isDisabled, m.isChronic)
  const position = m.isHead ? 'หัวหน้าครัวเรือน' : (m.familyPosition ?? 'สมาชิก')
  const sex: HouseholdMember['sex'] =
    m.sex === 'ชาย' ? 'ชาย' : m.sex === 'หญิง' ? 'หญิง' : '-'
  return {
    pid: intFromUuid(m.id),
    name: `${m.prefix ?? ''}${m.firstName}${m.lastName ? ' ' + m.lastName : ''}`.trim(),
    age,
    sex,
    position,
    group,
    isHead: m.isHead,
    father: m.father || undefined,
    mother: m.mother || undefined,
    mate: m.mate || undefined,
  }
}

export async function getFamilyFolderSummary(): Promise<VillageSummary[]> {
  const db = getDb()
  const houseRows = await db.select().from(households)
  if (houseRows.length === 0) return []

  const memberRows = await db
    .select()
    .from(householdMembers)
    .where(inArray(householdMembers.householdId, houseRows.map((h) => h.id)))

  const membersByHouse = new Map<string, MemberRow[]>()
  for (const m of memberRows) {
    if (!m.householdId) continue // query กรองเฉพาะ member ที่ผูกครัวเรือนอยู่แล้ว
    const arr = membersByHouse.get(m.householdId) ?? []
    arr.push(m)
    membersByHouse.set(m.householdId, arr)
  }

  // group ครัวเรือนตาม villcode → สรุปรายหมู่บ้าน
  const villageMap = new Map<string, VillageSummary>()
  for (const h of houseRows) {
    const vcode = h.villcode ?? '-'
    let v = villageMap.get(vcode)
    if (!v) {
      v = {
        vcode,
        vname: h.villageName ?? '-',
        villno: h.villno ?? '',
        totalHouses: 0,
        vulnerableHouses: 0,
        elderly: 0,
        children: 0,
        disabled: 0,
        chronic: 0,
      }
      villageMap.set(vcode, v)
    }

    v.totalHouses += 1
    const mem = membersByHouse.get(h.id) ?? []
    let houseHasVulnerable = false
    for (const m of mem) {
      const g = classifyGroup(m.age, m.isDisabled, m.isChronic)
      if (g === 'ผู้สูงอายุ') v.elderly += 1
      else if (g === 'เด็กเล็ก') v.children += 1
      else if (g === 'ผู้พิการ') v.disabled += 1
      else if (g === 'โรคเรื้อรัง') v.chronic += 1
      if (g !== 'ทั่วไป') houseHasVulnerable = true
    }
    if (houseHasVulnerable) v.vulnerableHouses += 1
  }

  return Array.from(villageMap.values()).sort((a, b) =>
    (a.villno || '').localeCompare(b.villno || '', 'th', { numeric: true }),
  )
}

export async function getFamilyFolderHouseholds(
  limit = 200,
  offset = 0,
  villcode?: string,
): Promise<{ households: VulnerableHousehold[]; total: number }> {
  const db = getDb()
  const houseRows = await db
    .select()
    .from(households)
    .where(villcode ? eq(households.villcode, villcode) : undefined)
    .orderBy(asc(households.villno), asc(households.hno))
  if (houseRows.length === 0) return { households: [], total: 0 }

  const memberRows = await db
    .select()
    .from(householdMembers)
    .where(inArray(householdMembers.householdId, houseRows.map((h) => h.id)))

  const membersByHouse = new Map<string, MemberRow[]>()
  for (const m of memberRows) {
    if (!m.householdId) continue // query กรองเฉพาะ member ที่ผูกครัวเรือนอยู่แล้ว
    const arr = membersByHouse.get(m.householdId) ?? []
    arr.push(m)
    membersByHouse.set(m.householdId, arr)
  }

  const buildHouse = (h: HouseRow): VulnerableHousehold | null => {
    const mem = (membersByHouse.get(h.id) ?? []).slice()
    // หัวหน้าครัวเรือนก่อน แล้วเรียงอายุมาก→น้อย
    mem.sort((a, b) => {
      if (a.isHead !== b.isHead) return a.isHead ? -1 : 1
      return (b.age ?? 0) - (a.age ?? 0)
    })
    const members = mem.map(toMember)
    const vulnerableCount = members.filter((x) => x.group !== 'ทั่วไป').length
    if (vulnerableCount === 0) return null // family folder แสดงเฉพาะครัวเรือนที่มีกลุ่มเปราะบาง
    return {
      hcode: intFromUuid(h.id),
      hno: h.hno ?? '-',
      village: h.villageName ?? '-',
      villno: h.villno ?? '',
      lat: h.lat != null ? Number(h.lat) : undefined,
      lng: h.lng != null ? Number(h.lng) : undefined,
      members,
      vulnerableCount,
    }
  }

  const all = houseRows
    .map(buildHouse)
    .filter((h): h is VulnerableHousehold => h !== null)

  return { households: all.slice(offset, offset + limit), total: all.length }
}

// หมุดบ้านสำหรับแผนที่ — เฉพาะบ้านที่มีพิกัด + มีสมาชิกกลุ่มเปราะบาง ≥1 คน
export async function getVulnerableHouseholdMarkers(): Promise<HouseholdMapMarker[]> {
  const db = getDb()
  const houseRows = await db.select().from(households)
  if (houseRows.length === 0) return []

  const memberRows = await db
    .select()
    .from(householdMembers)
    .where(inArray(householdMembers.householdId, houseRows.map((h) => h.id)))

  const membersByHouse = new Map<string, MemberRow[]>()
  for (const m of memberRows) {
    if (!m.householdId) continue // query กรองเฉพาะ member ที่ผูกครัวเรือนอยู่แล้ว
    const arr = membersByHouse.get(m.householdId) ?? []
    arr.push(m)
    membersByHouse.set(m.householdId, arr)
  }

  const markers: HouseholdMapMarker[] = []
  for (const h of houseRows) {
    if (h.lat == null || h.lng == null) continue
    const mem = (membersByHouse.get(h.id) ?? []).slice().sort((a, b) => {
      if (a.isHead !== b.isHead) return a.isHead ? -1 : 1
      return (b.age ?? 0) - (a.age ?? 0)
    })
    const members: HouseholdMapMember[] = mem.map((m) => {
      const group = classifyGroup(m.age, m.isDisabled, m.isChronic)
      return {
        name: `${m.prefix ?? ''}${m.firstName}${m.lastName ? ' ' + m.lastName : ''}`.trim(),
        age: m.age ?? 0,
        sex: m.sex === 'ชาย' ? 'ชาย' : m.sex === 'หญิง' ? 'หญิง' : '-',
        position: m.isHead ? 'หัวหน้าครัวเรือน' : (m.familyPosition ?? 'สมาชิก'),
        group,
        isHead: m.isHead,
        isVulnerable: group !== 'ทั่วไป',
        phone: m.phone || null,
      }
    })
    const vulnerableCount = members.filter((x) => x.isVulnerable).length
    if (vulnerableCount === 0) continue
    markers.push({
      id: h.id,
      hno: h.hno ?? '-',
      village: h.villageName ?? '-',
      villno: h.villno ?? '',
      tambon: h.tambon ?? null,
      amphoe: h.amphoe ?? null,
      province: h.province ?? null,
      lat: Number(h.lat),
      lng: Number(h.lng),
      vulnerableCount,
      members,
    })
  }
  return markers
}
