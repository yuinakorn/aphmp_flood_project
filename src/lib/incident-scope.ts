import { cookies } from 'next/headers'
import { and, asc, desc, eq, or, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { incidents, incidentAreas } from '@/db/schema'
import { INCIDENT_COOKIE, NORMAL_SCOPE } from '@/lib/scope-cookie'
import type { Incident, IncidentArea, IncidentStatus, IncidentType, UserRole } from '@/types'

export { INCIDENT_COOKIE, NORMAL_SCOPE } from '@/lib/scope-cookie'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const FULL_ACCESS_ROLES: UserRole[] = ['admin', 'eoc', 'ddpm']
// ระดับชาติ = เห็น/จัดการได้ทุกจังหวัด (ข้าม province scope) — eoc คือ EOC ระดับจังหวัด จึงไม่นับ
const NATIONAL_ROLES: UserRole[] = ['admin', 'ddpm']

export function canSeeClosedIncidents(role: string | null | undefined): boolean {
  return FULL_ACCESS_ROLES.includes((role ?? '') as UserRole)
}

/** role ที่ไม่ถูกจำกัดด้วยจังหวัด (เห็นทุกจังหวัด) */
export function isNationalRole(role: string | null | undefined): boolean {
  return NATIONAL_ROLES.includes((role ?? '') as UserRole)
}

function rowToIncident(r: typeof incidents.$inferSelect): Incident {
  return {
    id: r.id,
    name: r.name,
    type: r.type as IncidentType,
    status: r.status as IncidentStatus,
    province: r.province ?? null,
    amphoe: r.amphoe ?? null,
    tambon: r.tambon ?? null,
    description: r.description ?? null,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
  }
}

/** อ่าน incidentId จาก cookie โดยไม่ validate กับ DB — 'normal'/ว่าง = ไม่มี incident (null) */
export async function getActiveIncidentId(): Promise<string | null> {
  const store = await cookies()
  const v = store.get(INCIDENT_COOKIE)?.value
  return v && v.length > 0 && v !== NORMAL_SCOPE ? v : null
}

/** ผู้ใช้เลือก scope แล้วหรือยัง (มีค่า cookie = เลือกแล้ว ไม่ว่าจะ incident หรือ 'normal') */
export async function hasSelectedScope(): Promise<boolean> {
  const store = await cookies()
  const v = store.get(INCIDENT_COOKIE)?.value
  return !!v && v.length > 0
}

/** บันทึกว่าเลือก "โหมดปกติทั้งจังหวัด" (ไม่ผูกเหตุการณ์) */
export async function setNormalScopeCookie(): Promise<void> {
  await setIncidentCookie(NORMAL_SCOPE)
}

/**
 * คืน Incident ปัจจุบันถ้ามีและ user มีสิทธิ์ดู
 * — return null ถ้า cookie ว่าง / incident ไม่พบ / user ไม่มีสิทธิ์ / อยู่นอกจังหวัดสังกัด
 *
 * อ่านอย่างเดียว ไม่แตะ cookie (Next 16 ห้ามเขียน cookie ตอน render Server Component)
 * cookie ที่ค้าง/ไม่ถูกต้องจะถูกเขียนทับเองตอนผู้ใช้เลือก scope ใหม่ผ่าน /api/incident-scope
 * — ดู getInvalidActiveIncidentId() สำหรับ flow บังคับเลือกใหม่
 */
export async function getActiveIncident(
  role: string | null | undefined,
  province: string | null | undefined,
): Promise<Incident | null> {
  const id = await getActiveIncidentId()
  if (!id) return null

  const db = getDb()
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!row) return null
  if (!canSeeClosedIncidents(role) && row.status === 'closed') return null

  const areas = await getIncidentAreas(id)

  // province guard — non-national เห็นได้เฉพาะเหตุการณ์ที่แตะจังหวัดสังกัด (พื้นที่หลัก หรือ area ใด ๆ)
  if (!isNationalRole(role)) {
    const myProvince = province ?? null
    const touchesMyProvince =
      row.province === myProvince || areas.some((a) => a.province === myProvince)
    if (!touchesMyProvince) return null
  }

  return { ...rowToIncident(row), areas }
}

/** โหลดพื้นที่ผลกระทบทั้งหมดของเหตุการณ์ — ถ้าไม่มีแถวเลย fallback เป็นพื้นที่หลักจาก incidents */
export async function getIncidentAreas(incidentId: string): Promise<IncidentArea[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: incidentAreas.id,
      province: incidentAreas.province,
      amphoe: incidentAreas.amphoe,
      tambon: incidentAreas.tambon,
    })
    .from(incidentAreas)
    .where(eq(incidentAreas.incidentId, incidentId))
    .orderBy(asc(incidentAreas.amphoe), asc(incidentAreas.tambon))
  return rows
}

/**
 * สร้าง SQL where สำหรับกรองสมาชิก/แถวตามพื้นที่ผลกระทบ (OR ข้าม area, แต่ละ area เป็น hierarchical)
 * cols = คอลัมน์ province/amphoe/tambon ของตารางเป้าหมาย — คืน undefined ถ้าไม่มี area (= ไม่จำกัดพื้นที่)
 */
export function areaMemberWhere(
  areas: IncidentArea[],
  cols: { province: AnyColumn; amphoe: AnyColumn; tambon: AnyColumn },
): SQL | undefined {
  if (!areas || areas.length === 0) return undefined
  const perArea = areas.map((a) => {
    const parts: SQL[] = []
    if (a.province) parts.push(sql`${cols.province} = ${a.province}`)
    if (a.amphoe) parts.push(sql`${cols.amphoe} = ${a.amphoe}`)
    if (a.tambon) parts.push(sql`${cols.tambon} = ${a.tambon}`)
    // area ว่างทั้งหมด (ไม่ระบุพื้นที่) → match ทุกแถว
    return parts.length ? sql`(${sql.join(parts, sql` AND `)})` : sql`TRUE`
  })
  return sql`(${sql.join(perArea, sql` OR `)})`
}

/** JS predicate รุ่นเดียวกับ areaMemberWhere — สำหรับกรอง array ใน-memory */
export function memberMatchesAreas(
  m: { province?: string | null; amphoe?: string | null; tambon?: string | null },
  areas: IncidentArea[] | undefined,
): boolean {
  if (!areas || areas.length === 0) return true
  return areas.some((a) => {
    if (a.province && m.province !== a.province) return false
    if (a.amphoe && m.amphoe !== a.amphoe) return false
    if (a.tambon && m.tambon !== a.tambon) return false
    return true
  })
}

/** รายชื่อเหตุการณ์ที่ user มีสิทธิ์เลือก — scope ตามจังหวัดสังกัด (national เห็นทุกจังหวัด) */
export async function getSelectableIncidents(
  role: string | null | undefined,
  province: string | null | undefined,
): Promise<Incident[]> {
  const national = isNationalRole(role)
  // non-national ที่ไม่มีจังหวัดสังกัด → ไม่เห็นเหตุการณ์ใดเลย
  if (!national && !province) return []

  const conds = []
  if (!national) conds.push(eq(incidents.province, province!))
  if (!canSeeClosedIncidents(role)) {
    conds.push(or(eq(incidents.status, 'active'), eq(incidents.status, 'monitoring'))!)
  }

  const db = getDb()
  const rows = await db
    .select()
    .from(incidents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(incidents.startedAt))
  return rows.map(rowToIncident)
}

export async function setIncidentCookie(id: string): Promise<void> {
  const store = await cookies()
  store.set(INCIDENT_COOKIE, id, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
  })
}

export async function clearIncidentCookie(): Promise<void> {
  const store = await cookies()
  store.set(INCIDENT_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true })
}
