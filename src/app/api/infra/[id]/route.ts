/**
 * DELETE /api/infra/:id — ลบจุดรับ-ส่งอพยพ (เฉพาะ type evacuation_point · ระดับสั่งการ)
 * ป้องกันการลบ รพ./ศูนย์พักพิง ผ่าน endpoint นี้
 */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { isNationalRole } from '@/lib/incident-scope'
import { audit } from '@/lib/audit'
import { infrastructures } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid id')

  const db = getDb()
  const [row] = await db.select().from(infrastructures).where(eq(infrastructures.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: 'ไม่พบจุด' }, { status: 404 })
  if (row.type !== 'evacuation_point') return forbidden() // ลบได้เฉพาะจุดรับ-ส่งอพยพ

  if (!isNationalRole(session.user.role) && row.province !== (session.user.province ?? null)) {
    return forbidden()
  }

  await db.delete(infrastructures).where(eq(infrastructures.id, id))

  void audit(req, session, {
    action: 'delete_evacuation_point',
    entity: 'infrastructure',
    targetId: id,
    metadata: { name: row.name, province: row.province },
  })

  return NextResponse.json({ ok: true })
}
