import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { infrastructures, shelterAdmissions, shelterZones } from '@/db/schema'

const SHELTER_TYPES = new Set(['shelter', 'assembly'])

// GET /api/shelters — list ศูนย์พักพิง (type=shelter|assembly) + occupancy ปัจจุบัน + zone count
export async function GET() {
  const session = await auth()
  if (!session?.user) return unauthorized()

  // province scope — เจ้าหน้าที่ (non-national) เห็นเฉพาะศูนย์ในจังหวัดสังกัด
  const national = isNationalRole(session.user.role)
  const province = session.user.province ?? null
  if (!national && !province) return NextResponse.json({ data: [] })

  const db = getDb()

  const shelters = await db
    .select()
    .from(infrastructures)
    .where(
      national
        ? inArray(infrastructures.type, ['shelter', 'assembly'])
        : and(inArray(infrastructures.type, ['shelter', 'assembly']), eq(infrastructures.province, province!)),
    )

  if (shelters.length === 0) return NextResponse.json({ data: [] })

  const ids = shelters.map((s) => s.id)

  const occupancy = await db
    .select({
      shelterId: shelterAdmissions.shelterId,
      current: sql<number>`coalesce(sum(case when ${shelterAdmissions.status} = 'admitted' then 1 else 0 end), 0)`,
      total: sql<number>`count(*)`,
    })
    .from(shelterAdmissions)
    .where(inArray(shelterAdmissions.shelterId, ids))
    .groupBy(shelterAdmissions.shelterId)

  const zoneCounts = await db
    .select({
      shelterId: shelterZones.shelterId,
      count: sql<number>`count(*)`,
    })
    .from(shelterZones)
    .where(inArray(shelterZones.shelterId, ids))
    .groupBy(shelterZones.shelterId)

  const occMap = new Map(occupancy.map((o) => [o.shelterId, o]))
  const zoneMap = new Map(zoneCounts.map((z) => [z.shelterId, Number(z.count)]))

  const data = shelters.map((s) => {
    const o = occMap.get(s.id)
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      capacity: s.capacity,
      occupancy: Number(o?.current ?? 0),
      cumulative: Number(o?.total ?? 0),
      zoneCount: zoneMap.get(s.id) ?? 0,
      readinessStatus: s.readinessStatus,
      lat: Number(s.lat),
      lng: Number(s.lng),
      bedriddenCapacity: s.bedriddenCapacity,
      oxygenSupport: s.oxygenSupport,
      wheelchairSupport: s.wheelchairSupport,
      electricitySupport: s.electricitySupport,
      contact: s.contact,
    }
  })

  return NextResponse.json({ data })
}

// POST /api/shelters — เพิ่มศูนย์พักพิง/จุดรวมพลใหม่ (admin/officer/eoc)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const type = typeof body.type === 'string' && SHELTER_TYPES.has(body.type) ? body.type : 'shelter'

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return badRequest('lat/lng required')

  // จังหวัด: non-national ล็อกเป็นจังหวัดสังกัด · national ระบุได้เอง
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' ? body.province : null)
    : (session.user.province ?? null)
  if (!national && !province) return badRequest('ไม่พบจังหวัดสังกัดของผู้ใช้')

  const db = getDb()
  const [created] = await db
    .insert(infrastructures)
    .values({
      name,
      type,
      capacity: typeof body.capacity === 'number' ? body.capacity : null,
      bedriddenCapacity: typeof body.bedriddenCapacity === 'number' ? body.bedriddenCapacity : null,
      oxygenSupport: Boolean(body.oxygenSupport),
      wheelchairSupport: Boolean(body.wheelchairSupport),
      electricitySupport: Boolean(body.electricitySupport),
      contact: typeof body.contact === 'string' ? body.contact : null,
      tambon: typeof body.tambon === 'string' ? body.tambon : null,
      amphoe: typeof body.amphoe === 'string' ? body.amphoe : null,
      province,
      lat: String(lat),
      lng: String(lng),
      readinessStatus: 'open',
    })
    .returning()

  void audit(req, session, {
    action: 'create_shelter',
    entity: 'infrastructure',
    targetId: created.id,
    metadata: { type: created.type, province: created.province },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
