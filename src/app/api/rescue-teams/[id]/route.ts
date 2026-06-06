import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, unauthorized } from '@/lib/field-api'
import { rescueTeams } from '@/db/schema'
import { audit } from '@/lib/audit'

const TEAM_TYPES = new Set([
  'rescue_boat', 'gmc_truck', 'ems_medical', 'mcat_psych', 'volunteer_kitchen', 'other',
])
const STATUSES = new Set(['active', 'standby', 'offline'])

// PATCH /api/rescue-teams/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  const db = getDb()
  const [existing] = await db.select().from(rescueTeams).where(eq(rescueTeams.id, id))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON')

  const patch: Partial<typeof rescueTeams.$inferInsert> = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.teamType === 'string' && TEAM_TYPES.has(body.teamType)) patch.teamType = body.teamType
  if (typeof body.contact === 'string') patch.contact = body.contact || null
  if (typeof body.zone === 'string') patch.zone = body.zone || null
  if (typeof body.status === 'string' && STATUSES.has(body.status)) patch.status = body.status

  if (Object.keys(patch).length === 0) return badRequest('No valid fields')

  const [updated] = await db.update(rescueTeams).set(patch).where(eq(rescueTeams.id, id)).returning()

  void audit(req, session, {
    action: 'update_rescue_team',
    entity: 'rescue_team',
    targetId: id,
    metadata: { fields: Object.keys(patch) },
  })

  return NextResponse.json({ data: updated })
}

// DELETE /api/rescue-teams/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const { id } = await params
  const db = getDb()
  const [existing] = await db.select().from(rescueTeams).where(eq(rescueTeams.id, id))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(rescueTeams).where(eq(rescueTeams.id, id))

  void audit(req, session, {
    action: 'delete_rescue_team',
    entity: 'rescue_team',
    targetId: id,
    metadata: { name: existing.name },
  })

  return new NextResponse(null, { status: 204 })
}
