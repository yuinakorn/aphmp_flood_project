import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
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
import { healthVisits, vulnerablePersons } from '@/db/schema'
import type { FollowUpStatus } from '@/types'

const VISIT_STATUSES = new Set(['pending', 'completed', 'unreachable', 'needs_follow_up'])
const PERSON_STATUSES = new Set(['safe', 'needs_help', 'evacuated', 'referred', 'unknown'])

function followUpStatusFromVisit(body: Record<string, unknown>): FollowUpStatus {
  if (body.needsHelp === true || body.personStatus === 'needs_help') return 'needs_help'
  if (body.personStatus === 'evacuated') return 'moved'
  if (body.personStatus === 'referred') return 'referred'
  if (body.visitStatus === 'completed') return 'contacted'
  return 'pending'
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const vulnerablePersonId = body.vulnerablePersonId
  if (vulnerablePersonId !== undefined && !isUuid(vulnerablePersonId)) {
    return badRequest('vulnerablePersonId must be a UUID')
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
  const observedAt = isoOrNow(body.observedAt)
  const [created] = await db
    .insert(healthVisits)
    .values({
      vulnerablePersonId: vulnerablePersonId ?? null,
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

  if (vulnerablePersonId) {
    await db
      .update(vulnerablePersons)
      .set({
        followUpStatus: followUpStatusFromVisit(body),
        lastVisitedAt: observedAt,
        lastKnownStatus: personStatus ?? visitStatus,
        updatedAt: new Date(),
      })
      .where(eq(vulnerablePersons.id, vulnerablePersonId))
  }

  return NextResponse.json({ data: created }, { status: 201 })
}
