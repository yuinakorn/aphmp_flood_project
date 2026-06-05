/**
 * DELETE /api/flood-risk-zones/:id — ลบโซนเสี่ยง (soft delete, ระดับสั่งการเท่านั้น)
 */
import { NextRequest, NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { floodRiskZones } from '@/db/schema'

export const dynamic = 'force-dynamic'

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
