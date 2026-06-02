import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canManageIncident, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { getIncidentAreas, isNationalRole } from '@/lib/incident-scope'
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '@/lib/incident'
import { incidents, incidentAreas } from '@/db/schema'
import type { IncidentArea } from '@/types'

/** sanitize areas (เหมือนใน POST) — non-national ล็อก province */
function sanitizeAreas(rawList: unknown, lockedProvince: string | null): IncidentArea[] {
  if (!Array.isArray(rawList)) return []
  const out: IncidentArea[] = []
  const seen = new Set<string>()
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const province = lockedProvince ?? (typeof a.province === 'string' && a.province ? a.province : null)
    const amphoe = typeof a.amphoe === 'string' && a.amphoe ? a.amphoe : null
    const tambon = typeof a.tambon === 'string' && a.tambon ? a.tambon : null
    if (!province && !amphoe && !tambon) continue
    const k = `${province ?? ''}|${amphoe ?? ''}|${tambon ?? ''}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ province, amphoe, tambon })
  }
  return out
}

// PATCH /api/incidents/[id] — แก้ไข/ปิดเหตุการณ์ (ผู้บัญชาการ: admin/eoc/ddpm)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageIncident(session.user.role)) return forbidden()

  // province guard — non-national แก้ได้เฉพาะเหตุการณ์ในจังหวัดสังกัด
  const db = getDb()
  const [existing] = await db.select().from(incidents).where(eq(incidents.id, id))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isNationalRole(session.user.role) && existing.province !== (session.user.province ?? null)) {
    return forbidden()
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof incidents.$inferInsert> = { updatedAt: new Date() }

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return badRequest('name must be a non-empty string')
    patch.name = name
  }

  if ('type' in body) {
    if (!INCIDENT_TYPES.has(body.type as string)) return badRequest('Invalid type')
    patch.type = body.type as string
  }

  if ('status' in body) {
    if (!INCIDENT_STATUSES.has(body.status as string)) return badRequest('Invalid status')
    patch.status = body.status as string
    // ปิดเหตุการณ์ → ประทับเวลาสิ้นสุด; เปิดใหม่ → ล้าง endedAt
    patch.endedAt = body.status === 'closed' ? new Date() : null
  }

  // non-national เปลี่ยนจังหวัดของเหตุการณ์ไม่ได้ (กันย้ายออกนอก scope)
  const editableLoc = isNationalRole(session.user.role)
    ? (['province', 'amphoe', 'tambon', 'description'] as const)
    : (['amphoe', 'tambon', 'description'] as const)
  for (const field of editableLoc) {
    if (field in body) {
      patch[field] = typeof body[field] === 'string' ? (body[field] as string) : null
    }
  }

  // จัดการพื้นที่ผลกระทบ (multi-อำเภอ/ตำบล) — replace ทั้งชุดเมื่อส่ง areas[] มา
  let newAreas: IncidentArea[] | null = null
  if ('areas' in body) {
    const locked = isNationalRole(session.user.role) ? null : (session.user.province ?? null)
    newAreas = sanitizeAreas(body.areas, locked)
    if (newAreas.length === 0) return badRequest('ต้องมีพื้นที่ผลกระทบอย่างน้อย 1 พื้นที่')
    // sync พื้นที่หลักจาก area แรก
    patch.province = newAreas[0].province ?? null
    patch.amphoe = newAreas[0].amphoe ?? null
    patch.tambon = newAreas[0].tambon ?? null
  }

  if (Object.keys(patch).length === 1 && !newAreas) return badRequest('No updatable fields provided')

  const [updated] = await db
    .update(incidents)
    .set(patch)
    .where(eq(incidents.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (newAreas) {
    await db.delete(incidentAreas).where(eq(incidentAreas.incidentId, id))
    await db.insert(incidentAreas).values(
      newAreas.map((a) => ({ incidentId: id, province: a.province ?? null, amphoe: a.amphoe ?? null, tambon: a.tambon ?? null })),
    )
  }

  return NextResponse.json({ data: { ...updated, areas: await getIncidentAreas(id) } })
}
