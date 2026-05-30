import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { badRequest, canTriage, forbidden, sessionUserId, unauthorized } from '@/lib/field-api'
import { rescueTeams } from '@/db/schema'
import { getActiveIncidentId } from '@/lib/incident-scope'

const TEAM_TYPES = new Set([
  'rescue_boat',
  'gmc_truck',
  'ems_medical',
  'mcat_psych',
  'volunteer_kitchen',
  'other',
])

// GET /api/rescue-teams — list (ทุก role ที่ login)
// ?scope=all → ทั้งหมด; default → ผูกกับ incident-scope cookie (ถ้ามี)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const scopeMode = new URL(req.url).searchParams.get('scope') ?? 'auto'
  const incidentId = scopeMode === 'all' ? null : await getActiveIncidentId()

  const db = getDb()
  const base = db.select().from(rescueTeams).$dynamic()
  const scoped = incidentId ? base.where(eq(rescueTeams.incidentId, incidentId)) : base
  const rows = await scoped.orderBy(desc(rescueTeams.createdAt))
  return NextResponse.json({ data: rows })
}

// POST /api/rescue-teams — ขึ้นทะเบียนทีม (admin/officer/eoc)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const teamType = typeof body.teamType === 'string' && TEAM_TYPES.has(body.teamType) ? body.teamType : 'other'

  const db = getDb()
  const incidentId = await getActiveIncidentId()
  const [created] = await db
    .insert(rescueTeams)
    .values({
      name,
      teamType,
      incidentId,
      contact: typeof body.contact === 'string' ? body.contact : null,
      zone: typeof body.zone === 'string' ? body.zone : null,
      status: 'active',
      registeredBy: sessionUserId(session),
    })
    .returning()

  return NextResponse.json({ data: created }, { status: 201 })
}
