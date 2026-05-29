import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canTriage,
  forbidden,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '@/lib/incident'
import { incidents } from '@/db/schema'

// GET /api/incidents?status=active — list เหตุการณ์ (ทุก role ที่ login)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()

  const status = new URL(req.url).searchParams.get('status')
  if (status && !INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  const db = getDb()
  const rows = await db
    .select()
    .from(incidents)
    .where(status ? eq(incidents.status, status) : undefined)
    .orderBy(desc(incidents.startedAt))

  return NextResponse.json({ data: rows })
}

// POST /api/incidents — เปิดเหตุการณ์วิกฤต (admin/officer/eoc)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return badRequest('name is required')

  const type = typeof body.type === 'string' ? body.type : 'flood'
  if (!INCIDENT_TYPES.has(type)) return badRequest('Invalid type')

  const status = typeof body.status === 'string' ? body.status : 'active'
  if (!INCIDENT_STATUSES.has(status)) return badRequest('Invalid status')

  const db = getDb()
  const [created] = await db
    .insert(incidents)
    .values({
      name,
      type,
      status,
      province: typeof body.province === 'string' ? body.province : null,
      amphoe: typeof body.amphoe === 'string' ? body.amphoe : null,
      tambon: typeof body.tambon === 'string' ? body.tambon : null,
      description: typeof body.description === 'string' ? body.description : null,
      createdBy: sessionUserId(session),
    })
    .returning()

  return NextResponse.json({ data: created }, { status: 201 })
}
