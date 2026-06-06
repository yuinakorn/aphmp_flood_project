import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, isUuid, unauthorized } from '@/lib/field-api'
import { audit } from '@/lib/audit'
import { shelterAdmissions } from '@/db/schema'

const VALID_EXIT_REASONS = new Set([
  'moved_home', 'moved_relative', 'admitted_hospital', 'transferred_shelter',
  'self_discharge', 'lost_contact', 'deceased', 'other',
])
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
  if (typeof body.intakePoint === 'string') patch.intakePoint = body.intakePoint
  if (typeof body.broughtByText === 'string') patch.broughtByText = body.broughtByText
  if (typeof body.broughtByTeamId === 'string' && isUuid(body.broughtByTeamId)) patch.broughtByTeamId = body.broughtByTeamId
  if (body.broughtByTeamId === null) patch.broughtByTeamId = null

  if (Object.keys(patch).length === 0) return badRequest('no fields to update')

  const db = getDb()
  const [updated] = await db
    .update(shelterAdmissions)
    .set(patch)
    .where(eq(shelterAdmissions.id, admissionId))
    .returning()

  void audit(req, session, {
    action: patch.status ? `admission_${patch.status}` : 'update_admission',
    entity: 'shelter_admission',
    targetId: admissionId,
    metadata: { status: patch.status, exitReason: patch.exitReason },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ admissionId: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()
  const { admissionId } = await params
  if (!isUuid(admissionId)) return badRequest('invalid admission id')

  const db = getDb()
  const [deleted] = await db
    .delete(shelterAdmissions)
    .where(eq(shelterAdmissions.id, admissionId))
    .returning({ id: shelterAdmissions.id })

  if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 })

  void audit(req, session, {
    action: 'delete_admission',
    entity: 'shelter_admission',
    targetId: admissionId,
    metadata: {},
  })

  return NextResponse.json({ data: deleted })
}
