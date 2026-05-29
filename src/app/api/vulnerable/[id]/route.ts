/**
 * GET  /api/vulnerable/[id] — ดูรายละเอียดคนเดียว + PDPA mask เหมือน list
 * PATCH /api/vulnerable/[id] — officer/admin อัปเดต followUpStatus, careUnit, assignedVhvId, medicalPriority
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { classifyRisk } from '@/lib/geo'
import {
  badRequest,
  canWriteFieldData,
  composeName,
  forbidden,
  isUuid,
  numberFromDb,
  sessionUserId,
  unauthorized,
} from '@/lib/field-api'
import { accessLog, vulnerablePersons } from '@/db/schema'
import type { UserRole } from '@/types'
import floodPointsData from '../../../../../public/data/flood-points.json'

const floodCoords: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

const FULL_ACCESS_ROLES = new Set<UserRole>(['admin', 'officer', 'eoc', 'vhv', 'ems', 'ddpm'])
function canViewFull(role?: UserRole): role is UserRole {
  return !!role && FULL_ACCESS_ROLES.has(role)
}

// -----------------------------------------------------------------------
// GET
// -----------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  const role = (session?.user?.role ?? 'anonymous') as UserRole
  const fullAccess = canViewFull(role)

  const db = getDb()
  const [p] = await db
    .select()
    .from(vulnerablePersons)
    .where(eq(vulnerablePersons.id, id))
    .limit(1)

  if (!p || p.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lat = numberFromDb(p.lat)
  const lng = numberFromDb(p.lng)
  const risk = lat !== null && lng !== null ? classifyRisk(lat, lng, floodCoords) : 'safe'

  if (fullAccess && session?.user?.id) {
    void db
      .insert(accessLog)
      .values({ userId: session.user.id, action: 'view_vulnerable', targetId: p.id, ip: null })
      .catch(() => {})
  }

  if (!fullAccess) {
    return NextResponse.json({
      data: {
        id: p.id,
        type: p.type,
        label: p.label,
        tambon: p.tambon,
        amphoe: p.amphoe,
        province: p.province,
        risk,
        followUpStatus: p.followUpStatus,
        medicalPriority: p.medicalPriority,
        lat: lat !== null ? Math.round(lat * 100) / 100 : null,
        lng: lng !== null ? Math.round(lng * 100) / 100 : null,
      },
    })
  }

  return NextResponse.json({
    data: {
      id: p.id,
      name: composeName(p.prefix, p.firstName, p.lastName),
      prefix: p.prefix,
      firstName: p.firstName,
      lastName: p.lastName,
      type: p.type,
      label: p.label,
      age: p.age,
      cond: p.cond,
      equipment: p.equipment,
      village: p.village,
      tambon: p.tambon,
      amphoe: p.amphoe,
      province: p.province,
      lat,
      lng,
      caregiverPhone: p.caregiverPhone,
      careUnit: p.careUnit,
      assignedVhvId: p.assignedVhvId,
      medicalPriority: p.medicalPriority,
      followUpStatus: p.followUpStatus,
      lastContactedAt: p.lastContactedAt?.toISOString() ?? null,
      lastVisitedAt: p.lastVisitedAt?.toISOString() ?? null,
      lastKnownStatus: p.lastKnownStatus,
      consent: p.consent,
      sourceSystem: p.sourceSystem,
      sourceUnit: p.sourceUnit,
      sourceSyncedAt: p.sourceSyncedAt?.toISOString() ?? null,
      createdAt: p.createdAt?.toISOString() ?? null,
      updatedAt: p.updatedAt?.toISOString() ?? null,
      risk,
    },
  })
}

// -----------------------------------------------------------------------
// PATCH — อัปเดตเฉพาะ field ที่ officer ควรแตะได้
// -----------------------------------------------------------------------

const VALID_FOLLOW_UP = new Set([
  'pending', 'contacted', 'needs_help', 'moved', 'referred', 'closed',
])
const VALID_PRIORITIES = new Set(['A', 'B', 'C'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return badRequest('id must be a UUID')

  const session = await auth()
  if (!session?.user) return unauthorized()
  if (!canWriteFieldData(session.user.role as UserRole)) return forbidden()

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return badRequest('Invalid JSON body')

  const patch: Partial<typeof vulnerablePersons.$inferInsert> = {
    updatedAt: new Date(),
  }

  if ('followUpStatus' in body) {
    if (!VALID_FOLLOW_UP.has(body.followUpStatus as string))
      return badRequest(`followUpStatus must be one of: ${[...VALID_FOLLOW_UP].join(', ')}`)
    patch.followUpStatus = body.followUpStatus as string
  }

  if ('medicalPriority' in body) {
    if (!VALID_PRIORITIES.has(body.medicalPriority as string))
      return badRequest('medicalPriority must be A, B, or C')
    patch.medicalPriority = body.medicalPriority as string
  }

  if ('careUnit' in body) {
    patch.careUnit = typeof body.careUnit === 'string' ? body.careUnit : null
  }

  if ('assignedVhvId' in body) {
    if (body.assignedVhvId !== null && !isUuid(body.assignedVhvId))
      return badRequest('assignedVhvId must be a UUID or null')
    patch.assignedVhvId = (body.assignedVhvId as string | null) ?? null
  }

  if ('lastKnownStatus' in body) {
    patch.lastKnownStatus = typeof body.lastKnownStatus === 'string' ? body.lastKnownStatus : null
  }

  if ('lastContactedAt' in body) {
    const d = body.lastContactedAt ? new Date(body.lastContactedAt as string) : null
    patch.lastContactedAt = d && !isNaN(d.getTime()) ? d : null
  }

  // ถ้าไม่มี field นอกจาก updatedAt → ไม่มีอะไรอัปเดต
  if (Object.keys(patch).length === 1) return badRequest('No updatable fields provided')

  const db = getDb()
  const [updated] = await db
    .update(vulnerablePersons)
    .set(patch)
    .where(eq(vulnerablePersons.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  void db
    .insert(accessLog)
    .values({
      userId: sessionUserId(session),
      action: 'update_vulnerable',
      targetId: id,
      ip: null,
    })
    .catch(() => {})

  return NextResponse.json({ data: updated })
}
