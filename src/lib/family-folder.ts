import { getDb } from '@/lib/db'
import { households, householdMembers, shelterAdmissions, infrastructures } from '@/db/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { classifyRiskByPolygons } from '@/lib/geo'
import { loadRiskZonesByProvince, zonesFor } from '@/lib/flood-risk'
import type { RiskLevel } from '@/types'

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
  id: string
  hcode: number
  hno: string
  village: string
  villno: string
  tambon?: string
  province?: string
  lat?: number
  lng?: number
  members: HouseholdMember[]
  vulnerableCount: number
  // เติมเฉพาะโหมดวิกฤต (withRisk) — ใช้เรียง/ติดป้ายบ้านเสี่ยง
  floodRisk?: RiskLevel
  evacuated?: boolean
  shelterName?: string | null
}

// สมาชิกบ้านสำหรับ popup บนแผนที่ — มีเบอร์ + flag กลุ่มเปราะบาง
export interface HouseholdMapMember {
  name: string
  age: number
  sex: 'ชาย' | 'หญิง' | '-'
  position: string
  group: HouseholdMember['group']
  categories: string[]
  isHead: boolean
  isVulnerable: boolean
  phone: string | null
  shelterId?: string | null
  shelterName?: string | null
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

// อยู่ในทะเบียนกลุ่มเปราะบางหรือไม่ — type IS NOT NULL (ทะเบียนดูแล เช่น ติดเตียง/ตั้งครรภ์)
// หรือเข้ากลุ่มประชากรเปราะบางตามอายุ/พิการ/โรคเรื้อรัง
function isVulnerableMember(m: MemberRow): boolean {
  return m.type != null || classifyGroup(m.age, m.isDisabled, m.isChronic) !== 'ทั่วไป'
}

// หมวดเปราะบางละเอียด (สำหรับตัวกรองแผนที่) — 1 คนอยู่ได้หลายหมวด
// keys: bedridden | dialysis | oxygen | disabled | pregnant | elderly | child
function memberCategories(
  type: string | null,
  lifeSupport: string[] | null,
  age: number | null,
  isDisabled: boolean,
): string[] {
  const cats: string[] = []
  const ls = lifeSupport ?? []
  if (type === 'bedridden') cats.push('bedridden')
  if (type === 'pregnant') cats.push('pregnant')
  if (type === 'disabled' || isDisabled) cats.push('disabled')
  if (ls.includes('oxygen') || ls.includes('ventilator')) cats.push('oxygen')
  if (ls.includes('dialysis_capd') || ls.includes('dialysis_hd')) cats.push('dialysis')
  if (age != null && age >= 70) cats.push('elderly')
  if (age != null && age <= 5) cats.push('child')
  return cats
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
  opts?: { withRisk?: boolean },
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
    const vulnerableCount = mem.filter(isVulnerableMember).length
    if (vulnerableCount === 0) return null // family folder แสดงเฉพาะครัวเรือนที่มีกลุ่มเปราะบาง
    return {
      id: h.id,
      hcode: intFromUuid(h.id),
      hno: h.hno ?? '-',
      village: h.villageName ?? '-',
      villno: h.villno ?? '',
      tambon: h.tambon ?? undefined,
      province: h.province ?? undefined,
      lat: h.lat != null ? Number(h.lat) : undefined,
      lng: h.lng != null ? Number(h.lng) : undefined,
      members,
      vulnerableCount,
    }
  }

  const all = houseRows
    .map(buildHouse)
    .filter((h): h is VulnerableHousehold => h !== null)

  const page = all.slice(offset, offset + limit)

  // โหมดวิกฤต — เติม flood-risk (polygon + buffer) + สถานะอพยพ ต่อบ้าน เพื่อเรียง/ติดป้าย
  if (opts?.withRisk && page.length > 0) {
    const zonesByProvince = await loadRiskZonesByProvince()
    for (const h of page) {
      h.floodRisk =
        h.lat != null && h.lng != null
          ? classifyRiskByPolygons(h.lat, h.lng, zonesFor(zonesByProvince, h.province ?? null))
          : 'safe'
    }

    // สถานะอพยพ — สมาชิกคนใดในบ้าน admitted อยู่ศูนย์พักพิง = บ้านนี้อพยพแล้ว
    const pageHouseIds = new Set(page.map((h) => h.id))
    const memberToHouse = new Map<string, string>()
    const pageMemberIds: string[] = []
    for (const m of memberRows) {
      if (m.householdId && pageHouseIds.has(m.householdId)) {
        memberToHouse.set(m.id, m.householdId)
        pageMemberIds.push(m.id)
      }
    }
    if (pageMemberIds.length > 0) {
      const admRows = await db
        .select({ memberId: shelterAdmissions.memberId, shelterName: infrastructures.name })
        .from(shelterAdmissions)
        .innerJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
        .where(and(inArray(shelterAdmissions.memberId, pageMemberIds), eq(shelterAdmissions.status, 'admitted')))
      const evac = new Map<string, string>() // householdId → shelterName
      for (const r of admRows) {
        const hid = r.memberId ? memberToHouse.get(r.memberId) : undefined
        if (hid) evac.set(hid, r.shelterName)
      }
      for (const h of page) {
        if (evac.has(h.id)) {
          h.evacuated = true
          h.shelterName = evac.get(h.id) ?? null
        }
      }
    }
  }

  return { households: page, total: all.length }
}

// หมุดบ้านสำหรับแผนที่ — เฉพาะบ้านที่มีพิกัด + มีสมาชิกกลุ่มเปราะบาง ≥1 คน
export async function getVulnerableHouseholdMarkers(
  province?: string | null,
): Promise<HouseholdMapMarker[]> {
  const db = getDb()
  const houseRows = await db
    .select()
    .from(households)
    .where(province ? eq(households.province, province) : undefined)
  if (houseRows.length === 0) return []

  const memberRows = await db
    .select()
    .from(householdMembers)
    .where(inArray(householdMembers.householdId, houseRows.map((h) => h.id)))

  // คนที่กำลังพักอยู่ศูนย์พักพิง (admitted)
  const memberIds = memberRows.map((m) => m.id)
  const admittedMap = new Map<string, { shelterId: string; shelterName: string }>()
  if (memberIds.length > 0) {
    const admRows = await db
      .select({
        memberId: shelterAdmissions.memberId,
        shelterId: shelterAdmissions.shelterId,
        shelterName: infrastructures.name,
      })
      .from(shelterAdmissions)
      .innerJoin(infrastructures, eq(shelterAdmissions.shelterId, infrastructures.id))
      .where(
        and(
          inArray(shelterAdmissions.memberId, memberIds),
          eq(shelterAdmissions.status, 'admitted'),
        ),
      )
    for (const r of admRows) {
      if (r.memberId) {
        admittedMap.set(r.memberId, { shelterId: r.shelterId, shelterName: r.shelterName })
      }
    }
  }

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
      const shelter = admittedMap.get(m.id)
      return {
        name: `${m.prefix ?? ''}${m.firstName}${m.lastName ? ' ' + m.lastName : ''}`.trim(),
        age: m.age ?? 0,
        sex: m.sex === 'ชาย' ? 'ชาย' : m.sex === 'หญิง' ? 'หญิง' : '-',
        position: m.isHead ? 'หัวหน้าครัวเรือน' : (m.familyPosition ?? 'สมาชิก'),
        group,
        categories: memberCategories(m.type, m.lifeSupport, m.age, m.isDisabled),
        isHead: m.isHead,
        isVulnerable: isVulnerableMember(m),
        phone: m.phone || null,
        shelterId: shelter?.shelterId ?? null,
        shelterName: shelter?.shelterName ?? null,
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
