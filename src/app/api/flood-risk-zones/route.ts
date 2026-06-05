/**
 * GET  /api/flood-risk-zones — โซนเสี่ยงน้ำท่วม (scope จังหวัดสังกัดอัตโนมัติ)
 * POST /api/flood-risk-zones — วาดโซนใหม่ (ระดับสั่งการเท่านั้น — canTriage)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { floodRiskZones } from '@/db/schema'
import type { FloodRiskZone } from '@/types'

export const dynamic = 'force-dynamic'

function serialize(row: typeof floodRiskZones.$inferSelect): FloodRiskZone {
  return {
    id: row.id,
    province: row.province,
    name: row.name,
    priority: row.priority,
    polygon: (row.polygon ?? []) as [number, number][],
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const national = isNationalRole(session.user.role)
  const sessionProvince = session.user.province ?? null
  const queryProvince = new URL(req.url).searchParams.get('province')
  const scopedProvince = national ? queryProvince : sessionProvince
  if (!national && !sessionProvince) return NextResponse.json({ data: [] })

  const db = getDb()
  const rows = await db
    .select()
    .from(floodRiskZones)
    .where(
      scopedProvince
        ? and(isNull(floodRiskZones.deletedAt), eq(floodRiskZones.province, scopedProvince))
        : isNull(floodRiskZones.deletedAt),
    )
    .orderBy(asc(floodRiskZones.priority), asc(floodRiskZones.createdAt))

  return NextResponse.json({ data: rows.map(serialize) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('ต้องระบุชื่อโซน')

  const polygon = body.polygon
  if (
    !Array.isArray(polygon) ||
    polygon.length < 3 ||
    !polygon.every(
      (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
  ) {
    return badRequest('polygon ต้องเป็น [lng, lat][] อย่างน้อย 3 จุด')
  }

  const priority = Number.isFinite(Number(body.priority)) ? Math.max(1, Math.trunc(Number(body.priority))) : 1

  // จังหวัด: non-national ล็อกเป็นจังหวัดสังกัด · national ระบุได้เอง
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' ? body.province : null)
    : (session.user.province ?? null)
  if (!province) return badRequest('ไม่พบจังหวัดของโซน')

  const db = getDb()
  const [created] = await db
    .insert(floodRiskZones)
    .values({
      province,
      name,
      priority,
      polygon: polygon as [number, number][],
      notes: typeof body.notes === 'string' ? body.notes : null,
      createdBy: sessionUserId(session),
    })
    .returning()

  void audit(req, session, {
    action: 'create_flood_risk_zone',
    entity: 'flood_risk_zone',
    targetId: created.id,
    metadata: { province, name, priority, points: polygon.length },
  })

  return NextResponse.json({ data: serialize(created) }, { status: 201 })
}
