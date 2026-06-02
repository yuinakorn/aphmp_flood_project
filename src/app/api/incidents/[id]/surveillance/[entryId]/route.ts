import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { diseaseSurveillance } from '@/db/schema'
import { audit } from '@/lib/audit'

// DELETE /api/incidents/[id]/surveillance/[entryId] — ลบบันทึกโรคเฝ้าระวัง (canTriage)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params
  if (!isUuid(id) || !isUuid(entryId)) return badRequest('id and entryId must be UUIDs')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const db = getDb()
  const [deleted] = await db
    .delete(diseaseSurveillance)
    .where(and(eq(diseaseSurveillance.id, entryId), eq(diseaseSurveillance.incidentId, id)))
    .returning({ id: diseaseSurveillance.id })

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  void audit(req, session, { action: 'delete_surveillance', entity: 'disease_surveillance', targetId: entryId, metadata: { incidentId: id } })

  return NextResponse.json({ data: { id: deleted.id } })
}
