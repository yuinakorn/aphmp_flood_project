/**
 * PATCH  /api/flood-risk-zones/:id — แก้ไขโซนเสี่ยง (ชื่อ/หมวด/ชนิดภัย/ลำดับ/สี/จุด — ระดับสั่งการเท่านั้น)
 * DELETE /api/flood-risk-zones/:id — ลบโซนเสี่ยง (soft delete, ระดับสั่งการเท่านั้น)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { floodRiskZones, hazardTypes } from '@/db/schema'
import { isZoneCategory, type ZoneCategory } from '@/lib/risk-zone'

export const dynamic = 'force-dynamic'

function isValidPolygon(p: unknown): p is [number, number][] {
  return (
    Array.isArray(p) &&
    p.length >= 3 &&
    p.every((pt) => Array.isArray(pt) && pt.length === 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const db = getDb()
  const [zone] = await db.select().from(floodRiskZones).where(eq(floodRiskZones.id, id)).limit(1)
  if (!zone || zone.deletedAt) return NextResponse.json({ error: 'ไม่พบโซน' }, { status: 404 })

  // non-national แก้ไขได้เฉพาะจังหวัดสังกัด
  if (!isNationalRole(session.user.role) && zone.province !== (session.user.province ?? null)) {
    return forbidden()
  }

  // เก็บเฉพาะฟิลด์ที่ส่งมา (partial update) — ตรวจค่าทีละฟิลด์
  const patch: Partial<typeof floodRiskZones.$inferInsert> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return badRequest('ต้องระบุชื่อโซน')
    patch.name = name
  }

  if (body.category !== undefined) {
    if (!isZoneCategory(body.category)) return badRequest('หมวดโซนไม่ถูกต้อง')
    patch.category = body.category as ZoneCategory
  }

  if (body.hazardType !== undefined) {
    const hazardType = typeof body.hazardType === 'string' ? body.hazardType.trim() : ''
    if (!hazardType) return badRequest('ต้องระบุชนิดภัย')
    const [hz] = await db
      .select({ code: hazardTypes.code, isActive: hazardTypes.isActive })
      .from(hazardTypes)
      .where(eq(hazardTypes.code, hazardType))
      .limit(1)
    if (!hz) return badRequest(`ไม่พบชนิดภัย "${hazardType}" ในทะเบียน`)
    if (!hz.isActive) return badRequest(`ชนิดภัย "${hazardType}" ถูกปิดใช้งาน`)
    patch.hazardType = hazardType
  }

  if (body.priority !== undefined) {
    if (!Number.isFinite(Number(body.priority))) return badRequest('ลำดับไม่ถูกต้อง')
    patch.priority = Math.max(1, Math.trunc(Number(body.priority)))
  }

  if (body.color !== undefined) {
    patch.color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : null
  }

  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === 'string' ? body.notes : null
  }

  if (body.polygon !== undefined) {
    if (!isValidPolygon(body.polygon)) return badRequest('polygon ต้องเป็น [lng, lat][] อย่างน้อย 3 จุด')
    patch.polygon = body.polygon
  }

  if (Object.keys(patch).length === 0) return badRequest('ไม่มีข้อมูลที่จะแก้ไข')

  patch.updatedAt = new Date()
  await db
    .update(floodRiskZones)
    .set(patch)
    .where(and(eq(floodRiskZones.id, id), isNull(floodRiskZones.deletedAt)))

  void audit(req, session, {
    action: 'update_flood_risk_zone',
    entity: 'flood_risk_zone',
    targetId: id,
    metadata: { province: zone.province, fields: Object.keys(patch).filter((k) => k !== 'updatedAt') },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid id')

  const db = getDb()
  const [zone] = await db.select().from(floodRiskZones).where(eq(floodRiskZones.id, id)).limit(1)
  if (!zone || zone.deletedAt) return NextResponse.json({ error: 'ไม่พบโซน' }, { status: 404 })

  // non-national ลบได้เฉพาะจังหวัดสังกัด
  if (!isNationalRole(session.user.role) && zone.province !== (session.user.province ?? null)) {
    return forbidden()
  }

  await db
    .update(floodRiskZones)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(floodRiskZones.id, id), isNull(floodRiskZones.deletedAt)))

  void audit(req, session, {
    action: 'delete_flood_risk_zone',
    entity: 'flood_risk_zone',
    targetId: id,
    metadata: { province: zone.province, name: zone.name },
  })

  return NextResponse.json({ ok: true })
}
