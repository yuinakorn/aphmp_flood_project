import { cookies } from 'next/headers'
import { desc, eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { incidents } from '@/db/schema'
import type { Incident, IncidentStatus, IncidentType, UserRole } from '@/types'

export const INCIDENT_COOKIE = 'gx-incident-id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const FULL_ACCESS_ROLES: UserRole[] = ['admin', 'eoc', 'ddpm']

export function canSeeClosedIncidents(role: string | null | undefined): boolean {
  return FULL_ACCESS_ROLES.includes((role ?? '') as UserRole)
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

/** อ่าน incidentId จาก cookie โดยไม่ validate กับ DB */
export async function getActiveIncidentId(): Promise<string | null> {
  const store = await cookies()
  const v = store.get(INCIDENT_COOKIE)?.value
  return v && v.length > 0 ? v : null
}

/**
 * คืน Incident ปัจจุบันถ้ามีและ user มีสิทธิ์ดู
 * — return null ถ้า cookie ว่าง / incident ไม่พบ / user ไม่มีสิทธิ์
 * (ในกรณีหลัง จะลบ cookie ทิ้งให้ด้วย)
 */
export async function getActiveIncident(role: string | null | undefined): Promise<Incident | null> {
  const id = await getActiveIncidentId()
  if (!id) return null

  const db = getDb()
  const [row] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!row) {
    await clearIncidentCookie()
    return null
  }

  if (!canSeeClosedIncidents(role) && row.status === 'closed') {
    await clearIncidentCookie()
    return null
  }

  return rowToIncident(row)
}

/** รายชื่อเหตุการณ์ที่ user มีสิทธิ์เลือก (Option A: role-based) */
export async function getSelectableIncidents(role: string | null | undefined): Promise<Incident[]> {
  const db = getDb()
  const base = db.select().from(incidents).$dynamic()
  const scoped = canSeeClosedIncidents(role)
    ? base
    : base.where(or(eq(incidents.status, 'active'), eq(incidents.status, 'monitoring'))!)
  const rows = await scoped.orderBy(desc(incidents.startedAt))
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
