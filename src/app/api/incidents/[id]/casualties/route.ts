import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canTriage,
  forbidden,
  isoOrNow,
  isUuid,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { incidentCasualties } from '@/db/schema'
import { audit } from '@/lib/audit'

const CASUALTY_TYPES = new Set(['injured', 'dead', 'missing', 'ill'])
const SEVERITIES = new Set(['minor', 'moderate', 'severe'])
const CAUSES = new Set(['drowning', 'electrocution', 'trauma', 'disease', 'other'])

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// GET /api/incidents/[id]/casualties — รายการผู้บาดเจ็บ/เสียชีวิตของเหตุการณ์ (canTriage)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const db = getDb()
  const rows = await db
    .select()
    .from(incidentCasualties)
    .where(eq(incidentCasualties.incidentId, id))
    .orderBy(desc(incidentCasualties.observedAt))
  return NextResponse.json({ data: rows })
}

// POST /api/incidents/[id]/casualties — บันทึก 1 ราย (canTriage)
export async function POST(
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

  const casualtyType = str(body.casualtyType)
  if (!casualtyType || !CASUALTY_TYPES.has(casualtyType)) {
    return badRequest('casualtyType must be one of injured|dead|missing|ill')
  }

  const severity = str(body.severity)
  if (severity && !SEVERITIES.has(severity)) return badRequest('Invalid severity')
  const cause = str(body.cause)
  if (cause && !CAUSES.has(cause)) return badRequest('Invalid cause')
  const memberId = str(body.memberId)
  if (memberId && !isUuid(memberId)) return badRequest('memberId must be a UUID')

  const ageRaw = body.age
  const age = typeof ageRaw === 'number' && Number.isFinite(ageRaw) ? Math.trunc(ageRaw) : null

  const db = getDb()
  const [created] = await db
    .insert(incidentCasualties)
    .values({
      incidentId: id,
      memberId,
      casualtyType,
      severity,
      personName: str(body.personName),
      age,
      sex: str(body.sex),
      cause,
      tambon: str(body.tambon),
      amphoe: str(body.amphoe),
      notes: str(body.notes),
      reportedBy: sessionUserId(session),
      observedAt: isoOrNow(body.observedAt),
    })
    .returning()

  void audit(req, session, {
    action: 'create_casualty',
    entity: 'incident_casualty',
    targetId: created.id,
    metadata: { incidentId: id, casualtyType, severity },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
