/**
 * GET /api/infra?types=hospital,clinic,shelter,assembly
 * รายชื่อสถานพยาบาล + ศูนย์พักพิง จาก DB (ไม่ใช่ static JSON)
 * scope จังหวัดสังกัดอัตโนมัติ (non-national) · public map ใช้ province query param
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { infrastructures } from '@/db/schema'
import { isNationalRole } from '@/lib/incident-scope'
import { badRequest, canTriage, forbidden, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'

const VALID_TYPES = new Set(['hospital', 'clinic', 'shelter', 'assembly', 'temporary_health_post', 'evacuation_point'])
const DEFAULT_TYPES = ['hospital', 'clinic', 'shelter', 'assembly', 'evacuation_point']
const ACCESS_MODES = new Set(['vehicle', 'boat', 'foot'])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const typesParam = searchParams.get('types')
  const types = typesParam
    ? typesParam.split(',').filter((t) => VALID_TYPES.has(t))
    : DEFAULT_TYPES
  if (types.length === 0) return NextResponse.json({ data: [] })

  const session = await auth()
  const national = isNationalRole(session?.user?.role)
  const sessionProvince = session?.user?.province ?? null

  // province scope: non-national → จังหวัดสังกัด; national → query param; no session → query param (public map)
  const queryProvince = searchParams.get('province')
  const scopedProvince = session?.user && !national ? sessionProvince : queryProvince

  if (session?.user && !national && !sessionProvince) return NextResponse.json({ data: [] })

  const db = getDb()
  const where = scopedProvince
    ? and(inArray(infrastructures.type, types), eq(infrastructures.province, scopedProvince))
    : inArray(infrastructures.type, types)

  const rows = await db
    .select({
      id: infrastructures.id,
      name: infrastructures.name,
      type: infrastructures.type,
      lat: infrastructures.lat,
      lng: infrastructures.lng,
      capacity: infrastructures.capacity,
      occupancy: infrastructures.occupancy,
      province: infrastructures.province,
      amphoe: infrastructures.amphoe,
      tambon: infrastructures.tambon,
      oxygenSupport: infrastructures.oxygenSupport,
      wheelchairSupport: infrastructures.wheelchairSupport,
      electricitySupport: infrastructures.electricitySupport,
      readinessStatus: infrastructures.readinessStatus,
      contact: infrastructures.contact,
      accessModes: infrastructures.accessModes,
    })
    .from(infrastructures)
    .where(where)

  return NextResponse.json({ data: rows })
}

// POST /api/infra — เพิ่ม "จุดรับ-ส่งอพยพ" (เฉพาะ type นี้ · ระดับสั่งการ)
// ศูนย์พักพิง/จุดรวมพล ใช้ /api/shelters เหมือนเดิม
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  if (body.type !== 'evacuation_point') return badRequest('POST นี้รองรับเฉพาะ evacuation_point')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('ต้องระบุชื่อจุด')

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return badRequest('lat/lng ไม่ถูกต้อง')

  const accessModes = Array.isArray(body.accessModes)
    ? (body.accessModes as unknown[]).filter((m): m is string => typeof m === 'string' && ACCESS_MODES.has(m))
    : []

  // จังหวัด: non-national ล็อกจังหวัดสังกัด · national ระบุเองได้
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' ? body.province : null)
    : (session.user.province ?? null)
  if (!province) return badRequest('ไม่พบจังหวัดของจุด')

  const db = getDb()
  const [created] = await db
    .insert(infrastructures)
    .values({
      name,
      type: 'evacuation_point',
      lat: String(lat),
      lng: String(lng),
      province,
      contact: typeof body.contact === 'string' ? body.contact : null,
      accessModes,
    })
    .returning()

  void audit(req, session, {
    action: 'create_evacuation_point',
    entity: 'infrastructure',
    targetId: created.id,
    metadata: { name, province, accessModes },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
