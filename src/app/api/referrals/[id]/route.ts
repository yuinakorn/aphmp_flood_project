/** PATCH /api/referrals/:id — ปลายทาง/ผู้ประสานอัปเดตสถานะการส่งต่อ */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { hospitalReferrals } from '@/db/schema'
import type { UserRole } from '@/types'

const VALID_STATUS = new Set(['pending', 'accepted', 'en_route', 'arrived', 'admitted', 'rejected', 'cancelled'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role as UserRole)) return forbidden()
  const { id } = await params
  if (!isUuid(id)) return badRequest('invalid referral id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof hospitalReferrals.$inferInsert> = { updatedAt: new Date() }
  if (typeof body.status === 'string') {
    if (!VALID_STATUS.has(body.status)) return badRequest('invalid status')
    patch.status = body.status
  }
  if (typeof body.notes === 'string') patch.notes = body.notes

  if (Object.keys(patch).length === 1) return badRequest('no fields to update')

  const db = getDb()
  const [updated] = await db.update(hospitalReferrals).set(patch).where(eq(hospitalReferrals.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  void audit(req, session, {
    action: 'update_referral_status',
    entity: 'hospital_referral',
    targetId: id,
    metadata: { status: patch.status },
  })

  return NextResponse.json({ data: updated })
}
