import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { incidents } from '@/db/schema'
import { isUuid } from '@/lib/field-api'

type Db = ReturnType<typeof getDb>

export async function getActiveIncidents(db: Db = getDb()) {
  return db
    .select()
    .from(incidents)
    .where(eq(incidents.status, 'active'))
    .orderBy(asc(incidents.startedAt))
}

// หา incidentId ที่จะผูกกับข้อมูลภาคสนามที่ถูกบันทึก:
// - ถ้า body ส่ง incidentId มา → ต้องเป็น uuid ที่มีจริง (คืน undefined ถ้าไม่ valid → ให้ caller badRequest)
// - ถ้าไม่ส่ง และมี active incident เพียงอันเดียว → ใช้อันนั้น
// - กรณีอื่น (ไม่มี/มีหลายอัน) → null
export async function resolveIncidentId(
  raw: unknown,
  db: Db = getDb(),
): Promise<{ ok: true; incidentId: string | null } | { ok: false; error: string }> {
  if (raw !== undefined && raw !== null) {
    if (!isUuid(raw)) return { ok: false, error: 'incidentId must be a UUID' }
    const [found] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(eq(incidents.id, raw))
      .limit(1)
    if (!found) return { ok: false, error: 'incidentId not found' }
    return { ok: true, incidentId: raw }
  }

  const active = await getActiveIncidents(db)
  return { ok: true, incidentId: active.length === 1 ? active[0].id : null }
}

export const INCIDENT_TYPES = new Set(['flood', 'storm', 'other'])
export const INCIDENT_STATUSES = new Set(['active', 'monitoring', 'closed'])
