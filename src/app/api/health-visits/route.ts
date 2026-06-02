import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import {
  badRequest,
  canWriteFieldData,
  forbidden,
  isoOrNow,
  isUuid,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { resolveIncidentId } from '@/lib/incident'
import { healthVisits, householdMembers } from '@/db/schema'
import { audit } from '@/lib/audit'
import type { FollowUpStatus, UserRole } from '@/types'

const VISIT_STATUSES = new Set(['pending', 'completed', 'unreachable', 'needs_follow_up'])
const PERSON_STATUSES = new Set(['safe', 'needs_help', 'evacuated', 'referred', 'unknown'])

function followUpStatusFromVisit(body: Record<string, unknown>): FollowUpStatus {
  if (body.needsHelp === true || body.personStatus === 'needs_help') return 'needs_help'
  if (body.personStatus === 'evacuated') return 'moved'
  if (body.personStatus === 'referred') return 'referred'
  if (body.visitStatus === 'completed') return 'contacted'
  return 'pending'
}

// -----------------------------------------------------------------------
// GET /api/health-visits?personId=<uuid|sourceId>&sourceSystem=<system>&limit=<n>
// officer+ เห็นประวัติการเยี่ยม — ไม่มี full access = forbidden
//
// personId รับได้ 2 แบบ:
//  1. UUID — ใช้ตรง ๆ
//  2. sourceId ของ JHCIS/HOSxP — ต้องส่ง sourceSystem มาด้วย, ระบบ resolve เป็น UUID ก่อน
// -----------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const { searchParams } = new URL(req.url)
  const personIdParam = searchParams.get('personId')
  const sourceSystem = searchParams.get('sourceSystem')
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

  const db = getDb()

  let resolvedPersonId: string | null = null

  if (personIdParam) {
    if (isUuid(personIdParam)) {
      resolvedPersonId = personIdParam
    } else {
      // ไม่ใช่ UUID — ลอง resolve จาก sourceId
      if (!sourceSystem) return badRequest('sourceSystem is required when personId is a sourceId (non-UUID)')
      const [found] = await db
        .select({ id: householdMembers.id })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.sourceId, personIdParam),
            eq(householdMembers.sourceSystem, sourceSystem),
          ),
        )
        .limit(1)
      if (!found) return NextResponse.json({ data: [], meta: { total: 0 } })
      resolvedPersonId = found.id
    }
  }

  const incidentIdParam = searchParams.get('incidentId')
  if (incidentIdParam && !isUuid(incidentIdParam)) return badRequest('incidentId must be a UUID')

  const filters = [
    resolvedPersonId ? eq(healthVisits.memberId, resolvedPersonId) : undefined,
    incidentIdParam ? eq(healthVisits.incidentId, incidentIdParam) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select()
    .from(healthVisits)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(healthVisits.observedAt))
    .limit(limit)

  return NextResponse.json({
    data: rows.map((v) => ({
      id: v.id,
      incidentId: v.incidentId,
      memberId: v.memberId,
      visitedBy: v.visitedBy,
      visitStatus: v.visitStatus,
      personStatus: v.personStatus,
      needsHelp: v.needsHelp,
      helpType: v.helpType,
      notes: v.notes,
      lat: v.lat ? Number(v.lat) : null,
      lng: v.lng ? Number(v.lng) : null,
      observedAt: v.observedAt?.toISOString() ?? null,
      syncedAt: v.syncedAt?.toISOString() ?? null,
      createdAt: v.createdAt?.toISOString() ?? null,
    })),
    meta: { total: rows.length },
  })
}

// -----------------------------------------------------------------------
// POST /api/health-visits
// -----------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const memberId = body.memberId
  if (memberId !== undefined && !isUuid(memberId)) {
    return badRequest('memberId must be a UUID')
  }

  const visitStatus = typeof body.visitStatus === 'string' ? body.visitStatus : 'completed'
  if (!VISIT_STATUSES.has(visitStatus)) return badRequest('Invalid visitStatus')

  const personStatus = typeof body.personStatus === 'string' ? body.personStatus : undefined
  if (personStatus && !PERSON_STATUSES.has(personStatus)) return badRequest('Invalid personStatus')

  const lat = body.lat === undefined || body.lat === null ? null : Number(body.lat)
  const lng = body.lng === undefined || body.lng === null ? null : Number(body.lng)
  if (lat !== null && !Number.isFinite(lat)) return badRequest('lat must be a number')
  if (lng !== null && !Number.isFinite(lng)) return badRequest('lng must be a number')

  const db = getDb()

  const incident = await resolveIncidentId(body.incidentId, db)
  if (!incident.ok) return badRequest(incident.error)

  const observedAt = isoOrNow(body.observedAt)
  const [created] = await db
    .insert(healthVisits)
    .values({
      incidentId: incident.incidentId,
      memberId: memberId ?? null,
      visitedBy: sessionUserId(session),
      visitStatus,
      personStatus: personStatus ?? null,
      needsHelp: body.needsHelp === true,
      helpType: typeof body.helpType === 'string' ? body.helpType : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
      lat: lat === null ? null : String(lat),
      lng: lng === null ? null : String(lng),
      observedAt,
      syncedAt: new Date(),
    })
    .returning()

  if (memberId) {
    await db
      .update(householdMembers)
      .set({
        followUpStatus: followUpStatusFromVisit(body),
        lastVisitedAt: observedAt,
        lastKnownStatus: personStatus ?? visitStatus,
        updatedAt: new Date(),
      })
      .where(eq(householdMembers.id, memberId))
  }

  void audit(req, session, {
    action: 'create_health_visit',
    entity: 'health_visit',
    targetId: created.id,
    metadata: { visitStatus: created.visitStatus, needsHelp: created.needsHelp, incidentId: created.incidentId },
  })

  return NextResponse.json({ data: created }, { status: 201 })
}
