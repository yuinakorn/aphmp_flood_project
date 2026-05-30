import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { incidentCasualties } from '@/db/schema'

// DELETE /api/incidents/[id]/casualties/[entryId] — ลบรายการผู้บาดเจ็บ/เสียชีวิต (canTriage)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params
  if (!isUuid(id) || !isUuid(entryId)) return badRequest('id and entryId must be UUIDs')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const db = getDb()
  const [deleted] = await db
    .delete(incidentCasualties)
    .where(and(eq(incidentCasualties.id, entryId), eq(incidentCasualties.incidentId, id)))
    .returning({ id: incidentCasualties.id })

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { id: deleted.id } })
}
