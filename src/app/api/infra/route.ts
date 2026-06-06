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

const FACILITY_TYPES = new Set(['hospital', 'clinic', 'temporary_health_post', 'evacuation_point'])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const type = typeof body.type === 'string' ? body.type : ''
  if (!FACILITY_TYPES.has(type)) return badRequest('ประเภทไม่ถูกต้อง')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('ต้องระบุชื่อ')

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return badRequest('lat/lng ไม่ถูกต้อง')

  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' ? body.province.trim() || null : null)
    : (session.user.province ?? null)
  if (!province) return badRequest('ไม่พบจังหวัดของจุด')

  const capacity = typeof body.capacity === 'number' && body.capacity > 0 ? Math.round(body.capacity) : null
  const accessModes = Array.isArray(body.accessModes)
    ? (body.accessModes as unknown[]).filter((m): m is string => typeof m === 'string' && ACCESS_MODES.has(m))
    : []
  const isMedical = type === 'hospital' || type === 'clinic' || type === 'temporary_health_post'

  const db = getDb()
  const [created] = await db
    .insert(infrastructures)
    .values({
      name,
      type,
      lat: String(lat),
      lng: String(lng),
      province,
      amphoe: typeof body.amphoe === 'string' ? body.amphoe.trim() || null : null,
      tambon: typeof body.tambon === 'string' ? body.tambon.trim() || null : null,
      contact: typeof body.contact === 'string' ? body.contact.trim() || null : null,
      capacity,
      healthCapacity: isMedical ? capacity : null,
      oxygenSupport: isMedical,
      electricitySupport: isMedical,
      wheelchairSupport: type === 'hospital',
      accessModes: type === 'evacuation_point' ? accessModes : [],
      occupancy: 0,
      readinessStatus: 'open',
    })
    .returning()

  void audit(req, session, {
    action: `create_${type}`,
    entity: 'infrastructure',
    targetId: created.id,
    metadata: { name, type, province },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
