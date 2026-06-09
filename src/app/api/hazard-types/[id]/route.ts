/**
 * PATCH  /api/hazard-types/:id — แก้ไขชนิดภัย (ผู้ดูแลระบบ) · code แก้ไม่ได้ถ้าเป็น isSystem
 * DELETE /api/hazard-types/:id — ลบ (ห้ามลบ isSystem หรือชนิดที่ยังมีโซนใช้อยู่)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canManageStaff, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { floodRiskZones, hazardTypes } from '@/db/schema'
import { isZoneCategory } from '@/lib/risk-zone'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const db = getDb()
  const [row] = await db.select().from(hazardTypes).where(eq(hazardTypes.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: 'ไม่พบชนิดภัย' }, { status: 404 })

  const patch: Partial<typeof hazardTypes.$inferInsert> = { updatedAt: new Date() }

  if (typeof body.label === 'string' && body.label.trim()) patch.label = body.label.trim()
  if (isZoneCategory(body.category)) patch.category = body.category
  if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim()
  if (typeof body.emoji === 'string' && body.emoji.trim()) patch.emoji = body.emoji.trim()
  if (Number.isFinite(Number(body.sortOrder))) patch.sortOrder = Math.trunc(Number(body.sortOrder))
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive

  // code แก้ได้เฉพาะชนิดที่ไม่ใช่ system และไม่มีโซนใช้อยู่ (กันอ้างอิงหลุด)
  if (typeof body.code === 'string' && body.code.trim() && body.code.trim() !== row.code) {
    if (row.isSystem) return badRequest('ชนิดภัยหลักของระบบแก้ code ไม่ได้')
    return badRequest('ไม่อนุญาตให้แก้ code เพื่อกันการอ้างอิงหลุด — ลบแล้วสร้างใหม่แทน')
  }

  const [updated] = await db.update(hazardTypes).set(patch).where(eq(hazardTypes.id, id)).returning()

  void audit(req, session, {
    action: 'update_hazard_type',
    entity: 'hazard_type',
    targetId: id,
    metadata: { code: row.code, changed: Object.keys(patch).filter((k) => k !== 'updatedAt') },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canManageStaff(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid id')

  const db = getDb()
  const [row] = await db.select().from(hazardTypes).where(eq(hazardTypes.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: 'ไม่พบชนิดภัย' }, { status: 404 })
  if (row.isSystem) return NextResponse.json({ error: 'ลบชนิดภัยหลักของระบบไม่ได้' }, { status: 409 })

  // กันลบถ้ายังมีโซน (ที่ไม่ถูกลบ) อ้างอิง code นี้อยู่
  const [inUse] = await db
    .select({ id: floodRiskZones.id })
    .from(floodRiskZones)
    .where(and(eq(floodRiskZones.hazardType, row.code), isNull(floodRiskZones.deletedAt)))
    .limit(1)
  if (inUse) {
    return NextResponse.json(
      { error: 'มีโซนใช้ชนิดภัยนี้อยู่ — ปิดใช้งาน (isActive=false) แทนการลบ' },
      { status: 409 },
    )
  }

  await db.delete(hazardTypes).where(eq(hazardTypes.id, id))

  void audit(req, session, {
    action: 'delete_hazard_type',
    entity: 'hazard_type',
    targetId: id,
    metadata: { code: row.code, label: row.label },
  })

  return NextResponse.json({ ok: true })
}
