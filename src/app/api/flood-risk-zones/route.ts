/**
 * GET  /api/flood-risk-zones — โซนเสี่ยงน้ำท่วม (scope จังหวัดสังกัดอัตโนมัติ)
 * POST /api/flood-risk-zones — วาดโซนใหม่ (ระดับสั่งการเท่านั้น — canTriage)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { floodRiskZones, hazardTypes } from '@/db/schema'
import type { FloodRiskZone } from '@/types'
import { FALLBACK_HAZARD, isZoneCategory, type ZoneCategory } from '@/lib/risk-zone'

export const dynamic = 'force-dynamic'

type HazardMeta = { label: string; color: string; emoji: string }

function serialize(row: typeof floodRiskZones.$inferSelect, meta: Map<string, HazardMeta>): FloodRiskZone {
  const m = meta.get(row.hazardType)
  return {
    id: row.id,
    province: row.province,
    name: row.name,
    category: (isZoneCategory(row.category) ? row.category : 'permanent') as ZoneCategory,
    hazardType: row.hazardType,
    hazardLabel: m?.label ?? FALLBACK_HAZARD.label,
    hazardColor: m?.color ?? FALLBACK_HAZARD.color,
    hazardEmoji: m?.emoji ?? FALLBACK_HAZARD.emoji,
    color: row.color,
    priority: row.priority,
    polygon: (row.polygon ?? []) as [number, number][],
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

async function loadHazardMeta(): Promise<Map<string, HazardMeta>> {
  const db = getDb()
  const rows = await db
    .select({ code: hazardTypes.code, label: hazardTypes.label, color: hazardTypes.color, emoji: hazardTypes.emoji })
    .from(hazardTypes)
  return new Map(rows.map((r) => [r.code, { label: r.label, color: r.color, emoji: r.emoji }]))
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const national = isNationalRole(session.user.role)
  const sessionProvince = session.user.province ?? null

  // จังหวัดที่ขอ scope: รับได้หลายค่า (เหตุการณ์ข้ามจังหวัด) ผ่าน ?province=a&province=b หรือ ?provinces=a,b
  const params = new URL(req.url).searchParams
  const requested = [
    ...params.getAll('province'),
    ...(params.get('provinces')?.split(',') ?? []),
  ]
    .map((p) => p.trim())
    .filter(Boolean)

  // non-national: ล็อกจังหวัดสังกัดเสมอ (ไม่เชื่อ query) · national: ใช้จังหวัดที่ขอ (ว่าง = ทุกจังหวัด)
  const scopeProvinces = national ? requested : (sessionProvince ? [sessionProvince] : [])
  if (!national && !sessionProvince) return NextResponse.json({ data: [] })

  const provinceFilter =
    scopeProvinces.length === 1
      ? eq(floodRiskZones.province, scopeProvinces[0])
      : scopeProvinces.length > 1
        ? inArray(floodRiskZones.province, scopeProvinces)
        : undefined

  const db = getDb()
  const [rows, meta] = await Promise.all([
    db
      .select()
      .from(floodRiskZones)
      .where(provinceFilter ? and(isNull(floodRiskZones.deletedAt), provinceFilter) : isNull(floodRiskZones.deletedAt))
      .orderBy(asc(floodRiskZones.priority), asc(floodRiskZones.createdAt)),
    loadHazardMeta(),
  ])

  return NextResponse.json({ data: rows.map((r) => serialize(r, meta)) })
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

  // ประเภทโซน: category (ถาวร/ชั่วคราว) + hazardType (code ชนิดภัยจาก hazard_types) — default permanent/flood
  const category: ZoneCategory = isZoneCategory(body.category) ? body.category : 'permanent'
  const hazardType = typeof body.hazardType === 'string' && body.hazardType.trim() ? body.hazardType.trim() : 'flood'

  const db = getDb()
  // ชนิดภัยต้องมีอยู่จริงและเปิดใช้งานในทะเบียน hazard_types (กันอ้างอิงหลุด)
  const [hz] = await db
    .select({ code: hazardTypes.code, isActive: hazardTypes.isActive })
    .from(hazardTypes)
    .where(eq(hazardTypes.code, hazardType))
    .limit(1)
  if (!hz) return badRequest(`ไม่พบชนิดภัย "${hazardType}" ในทะเบียน`)
  if (!hz.isActive) return badRequest(`ชนิดภัย "${hazardType}" ถูกปิดใช้งาน`)

  // จังหวัด: non-national ล็อกเป็นจังหวัดสังกัด · national ระบุได้เอง
  const national = isNationalRole(session.user.role)
  const province = national
    ? (typeof body.province === 'string' ? body.province : null)
    : (session.user.province ?? null)
  if (!province) return badRequest('ไม่พบจังหวัดของโซน')

  const [created] = await db
    .insert(floodRiskZones)
    .values({
      province,
      name,
      category,
      hazardType,
      priority,
      color: typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null,
      polygon: polygon as [number, number][],
      notes: typeof body.notes === 'string' ? body.notes : null,
      createdBy: sessionUserId(session),
    })
    .returning()

  void audit(req, session, {
    action: 'create_flood_risk_zone',
    entity: 'flood_risk_zone',
    targetId: created.id,
    metadata: { province, name, category, hazardType, priority, points: polygon.length },
  })

  return NextResponse.json({ data: serialize(created, await loadHazardMeta()) }, { status: 201 })
}
