import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canManageIncident,
  forbidden,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { getIncidentAreas, isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '@/lib/incident'
import { incidents, incidentAreas } from '@/db/schema'
import type { IncidentArea } from '@/types'

/**
 * sanitize รายการพื้นที่จาก body
 * - non-national: ทุก area ถูกล็อก province = จังหวัดสังกัด (กันสร้างนอก scope)
 * - ตัด area ที่ว่างเปล่า (ไม่มีระดับใดเลย) ทิ้ง
 * - fallback: ถ้าไม่ส่ง areas[] ใช้ {province, amphoe, tambon} ระดับบนสุดเป็น 1 area
 */
function sanitizeAreas(body: Record<string, unknown>, lockedProvince: string | null): IncidentArea[] {
  const raw: unknown[] = Array.isArray(body.areas)
    ? (body.areas as unknown[])
    : [{ province: body.province, amphoe: body.amphoe, tambon: body.tambon }]

  const out: IncidentArea[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    const province = lockedProvince ?? (typeof a.province === 'string' && a.province ? a.province : null)
    const amphoe = typeof a.amphoe === 'string' && a.amphoe ? a.amphoe : null
    const tambon = typeof a.tambon === 'string' && a.tambon ? a.tambon : null
    if (!province && !amphoe && !tambon) continue
    out.push({ province, amphoe, tambon })
  }
  // กันซ้ำ
  const seen = new Set<string>()
  return out.filter((a) => {
    const k = `${a.province ?? ''}|${a.amphoe ?? ''}|${a.tambon ?? ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// GET /api/incidents?status=active — list เหตุการณ์ (scope ตามจังหวัดสังกัด)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const status = new URL(req.url).searchParams.get('status')
  if (status && !INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  const national = isNationalRole(session.user.role)
  const province = session.user.province ?? null
  // non-national ที่ไม่มีจังหวัดสังกัด → ไม่เห็นเหตุการณ์ใดเลย
  if (!national && !province) return NextResponse.json({ data: [] })

  const conds = []
  if (status) conds.push(eq(incidents.status, status))
  if (!national) conds.push(eq(incidents.province, province!))

  const db = getDb()
  const rows = await db
    .select()
    .from(incidents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(incidents.startedAt))

  // แนบพื้นที่ผลกระทบทั้งหมดของแต่ละเหตุการณ์ (multi-อำเภอ/ตำบล)
  const withAreas = await Promise.all(
    rows.map(async (r) => ({ ...r, areas: await getIncidentAreas(r.id) })),
  )

  return NextResponse.json({ data: withAreas })
}

// POST /api/incidents — เปิดเหตุการณ์วิกฤต (ผู้บัญชาการ: admin/eoc/ddpm)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageIncident(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const type = typeof body.type === 'string' ? body.type : 'flood'
  if (!INCIDENT_TYPES.has(type)) return badRequest('Invalid type')

  const status = typeof body.status === 'string' ? body.status : 'active'
  if (!INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  // จังหวัด: non-national ล็อกเป็นจังหวัดสังกัดเสมอ (ไม่เชื่อ body) · national ระบุได้เอง
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' && body.province ? body.province : null)
    : (session.user.province ?? null)
  if (!national && !province) return badRequest('ไม่พบจังหวัดสังกัดของผู้ใช้ — ติดต่อผู้ดูแลระบบ')

  // พื้นที่ผลกระทบ (รองรับหลายอำเภอ/ตำบล) — non-national ล็อก province สังกัด
  const areas = sanitizeAreas(body, national ? null : province)
  if (areas.length === 0) return badRequest('ต้องระบุพื้นที่ผลกระทบอย่างน้อย 1 พื้นที่')
  // พื้นที่หลัก (display + guard) = พื้นที่แรก
  const primary = areas[0]

  const db = getDb()
  const [created] = await db
    .insert(incidents)
    .values({
      name,
      type,
      status,
      province: primary.province ?? province,
      amphoe: primary.amphoe ?? null,
      tambon: primary.tambon ?? null,
      description: typeof body.description === 'string' ? body.description : null,
      createdBy: sessionUserId(session),
    })
    .returning()

  await db.insert(incidentAreas).values(
    areas.map((a) => ({
      incidentId: created.id,
      province: a.province ?? null,
      amphoe: a.amphoe ?? null,
      tambon: a.tambon ?? null,
    })),
  )

  void audit(req, session, {
    action: 'create_incident',
    entity: 'incident',
    targetId: created.id,
    metadata: { type, status, province: created.province, areaCount: areas.length },
  })

  return NextResponse.json({ data: { ...created, areas } }, { status: 201 })
}
