import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canTriage,
  forbidden,
  isUuid,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { helpRequests, caseAssignments } from '@/db/schema'
import { audit } from '@/lib/audit'
import type { HelpRequestStatus } from '@/types'

const VALID_STATUSES = new Set(['new', 'triaged', 'assigned', 'en_route', 'resolved', 'cancelled'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const db = getDb()

  // Find the help request first
  const [existing] = await db
    .select()
    .from(helpRequests)
    .where(eq(helpRequests.id, id))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Help request not found' }, { status: 404 })
  }

  const patch: Partial<typeof helpRequests.$inferInsert> = {
    updatedAt: new Date(),
  }

  let newStatus = body.status as HelpRequestStatus | undefined
  if (newStatus !== undefined) {
    if (!VALID_STATUSES.has(newStatus)) {
      return badRequest(`status must be one of: ${[...VALID_STATUSES].join(', ')}`)
    }
    patch.status = newStatus
  }

  const rescueTeamId = body.rescueTeamId as string | undefined
  const assignedTeamName = body.assignedTeam as string | undefined
  const notes = body.notes as string | undefined

  if (rescueTeamId || assignedTeamName) {
    if (rescueTeamId && !isUuid(rescueTeamId)) {
      return badRequest('rescueTeamId must be a UUID')
    }
    // If team is assigned, transition status to 'assigned' if not specified
    if (!newStatus) {
      patch.status = 'assigned'
      newStatus = 'assigned'
    }
  }

  // Perform update in database
  const [updated] = await db
    .update(helpRequests)
    .set(patch)
    .where(eq(helpRequests.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Failed to update help request' }, { status: 500 })
  }

  // If assigning team OR resolving the case, insert into caseAssignments
  if (rescueTeamId || assignedTeamName || newStatus === 'resolved' || notes) {
    await db.insert(caseAssignments).values({
      helpRequestId: id,
      rescueTeamId: rescueTeamId ?? null,
      assignedTeam: assignedTeamName ?? null,
      assignedBy: sessionUserId(session),
      status: newStatus === 'resolved' ? 'closed' : 'assigned',
      notes: notes ?? null,
    })
  }

  void audit(req, session, {
    action: 'update_help_request',
    entity: 'help_request',
    targetId: id,
    metadata: {
      status: updated.status,
      rescueTeamId,
      assignedTeamName,
    },
  })

  return NextResponse.json({ data: updated })
}
