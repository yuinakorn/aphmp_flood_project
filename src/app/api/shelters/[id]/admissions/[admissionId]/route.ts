import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { shelterAdmissions } from '@/db/schema'

const VALID_EXIT_REASONS = new Set(['moved_home', 'admitted_hospital', 'transferred_shelter', 'other'])
const VALID_STATUSES = new Set(['admitted', 'transferred', 'discharged', 'cancelled'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ admissionId: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()
  const { admissionId } = await params
  if (!isUuid(admissionId)) return badRequest('invalid admission id')

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof shelterAdmissions.$inferInsert> = {}

  if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) {
    patch.status = body.status
    if (body.status !== 'admitted') patch.dischargedAt = new Date()
  }
  if (typeof body.exitReason === 'string' && VALID_EXIT_REASONS.has(body.exitReason)) {
    patch.exitReason = body.exitReason
  }
  if (typeof body.exitDestination === 'string') patch.exitDestination = body.exitDestination
  if (typeof body.notes === 'string') patch.notes = body.notes
  if (typeof body.zoneId === 'string' && isUuid(body.zoneId)) patch.zoneId = body.zoneId

  if (Object.keys(patch).length === 0) return badRequest('no fields to update')

  const db = getDb()
  const [updated] = await db
    .update(shelterAdmissions)
    .set(patch)
    .where(eq(shelterAdmissions.id, admissionId))
    .returning()

  return NextResponse.json({ data: updated })
}
