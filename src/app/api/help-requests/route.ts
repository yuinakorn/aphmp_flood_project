import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { classifyRisk } from '@/lib/geo'
import {
  badRequest,
  canTriage,
  canWriteFieldData,
  forbidden,
  isoOrNow,
  isUuid,
  numberFromDb,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { resolveIncidentId } from '@/lib/incident'
import { helpRequests, householdMembers } from '@/db/schema'
import type { HelpRequestPriority, MedicalPriority } from '@/types'
import floodPointsData from '../../../../public/data/flood-points.json'

const REQUEST_TYPES = new Set(['medical', 'evacuation', 'supplies', 'rescue', 'shelter', 'other'])
const PRIORITIES = new Set(['low', 'normal', 'high', 'critical'])

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

function escalatedPriority(
  current: HelpRequestPriority,
  medicalPriority?: MedicalPriority,
  risk?: 'flood' | 'near' | 'safe',
): HelpRequestPriority {
  if (current === 'critical') return current
  if (medicalPriority === 'A' && (risk === 'flood' || risk === 'near')) return 'high'
  return current
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canTriage(session.user.role)) return forbidden()

  const incidentId = new URL(req.url).searchParams.get('incidentId')
  if (incidentId && !isUuid(incidentId)) return badRequest('incidentId must be a UUID')

  const db = getDb()
  const rows = await db
    .select()
    .from(helpRequests)
    .where(incidentId ? eq(helpRequests.incidentId, incidentId) : undefined)
    .orderBy(desc(helpRequests.createdAt))
    .limit(100)

  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const requestType = typeof body.requestType === 'string' ? body.requestType : ''
  if (!REQUEST_TYPES.has(requestType)) return badRequest('Invalid requestType')

  const requestedPriority = typeof body.priority === 'string' ? body.priority : 'normal'
  if (!PRIORITIES.has(requestedPriority)) return badRequest('Invalid priority')

  const memberId = body.memberId
  if (memberId !== undefined && !isUuid(memberId)) {
    return badRequest('memberId must be a UUID')
  }

  const preferredShelterId = body.preferredShelterId
  if (preferredShelterId !== undefined && !isUuid(preferredShelterId)) {
    return badRequest('preferredShelterId must be a UUID')
  }

  const lat = body.lat === undefined || body.lat === null ? null : Number(body.lat)
  const lng = body.lng === undefined || body.lng === null ? null : Number(body.lng)
  if (lat !== null && !Number.isFinite(lat)) return badRequest('lat must be a number')
  if (lng !== null && !Number.isFinite(lng)) return badRequest('lng must be a number')

  const db = getDb()

  const incident = await resolveIncidentId(body.incidentId, db)
  if (!incident.ok) return badRequest(incident.error)

  let finalPriority = requestedPriority as HelpRequestPriority

  if (memberId) {
    const [person] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1)

    if (!person) return badRequest('memberId not found')

    const personLat = numberFromDb(person.lat)
    const personLng = numberFromDb(person.lng)
    const risk =
      personLat !== null && personLng !== null ? classifyRisk(personLat, personLng, floodCoords) : 'safe'
    finalPriority = escalatedPriority(
      finalPriority,
      person.medicalPriority as MedicalPriority,
      risk,
    )
  }

  const [created] = await db
    .insert(helpRequests)
    .values({
      incidentId: incident.incidentId,
      memberId: memberId ?? null,
      requestedBy: sessionUserId(session),
      sourceRole: session.user.role,
      requestType,
      priority: finalPriority,
      status: 'new',
      description: typeof body.description === 'string' ? body.description : null,
      lat: lat === null ? null : String(lat),
      lng: lng === null ? null : String(lng),
      preferredShelterId: preferredShelterId ?? null,
      observedAt: isoOrNow(body.observedAt),
      syncedAt: new Date(),
    })
    .returning()

  if (memberId) {
    await db
      .update(householdMembers)
      .set({
        followUpStatus: 'needs_help',
        lastContactedAt: new Date(),
        lastKnownStatus: requestType,
        updatedAt: new Date(),
      })
      .where(eq(householdMembers.id, memberId))
  }

  return NextResponse.json({ data: created }, { status: 201 })
}
